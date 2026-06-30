// Package notifications is the channel-agnostic dispatch layer (§7.8). It persists
// in-app notifications (the durable source of truth), pushes them live over SSE,
// and sends email/push off the request path. It implements bookings.Notifier and
// iam.Mailer so those modules depend only on narrow interfaces.
package notifications

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"github.com/aura/cbs/internal/bookings"
	"github.com/aura/cbs/internal/platform/db"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/mailer"
	"github.com/aura/cbs/internal/platform/pgconv"
)

type Service struct {
	store  *db.Store
	mail   mailer.Mailer
	broker *Broker
	log    *slog.Logger
}

func NewService(store *db.Store, mail mailer.Mailer, broker *Broker, log *slog.Logger) *Service {
	return &Service{store: store, mail: mail, broker: broker, log: log}
}

// BookingEvent fans a booking lifecycle event out to its recipients. It returns
// immediately; persistence and delivery happen on a background goroutine so a
// slow mail provider never blocks the request path (§7.8).
func (s *Service) BookingEvent(event string, b bookings.BookingView) {
	go s.dispatchBookingEvent(context.Background(), event, b)
}

func (s *Service) dispatchBookingEvent(ctx context.Context, event string, b bookings.BookingView) {
	title, body := renderBooking(event, b)
	entityType := "booking"
	bid := b.ID

	recipients, err := s.recipientsFor(ctx, event, b)
	if err != nil {
		s.log.Error("resolve notification recipients", "event", event, "err", err)
		return
	}
	for _, u := range recipients {
		n, err := s.store.CreateNotification(ctx, dbgen.CreateNotificationParams{
			UserID: u.ID, Channel: dbgen.NotifChannelINAPP, Type: event,
			Title: title, Body: body, RelatedEntityType: &entityType, RelatedEntityID: &bid,
			SentAt: pgconv.TS(time.Now()),
		})
		if err != nil {
			s.log.Error("persist notification", "err", err)
			continue
		}
		s.broker.Publish(n)
		if u.Email != "" {
			if err := s.mail.Send(ctx, u.Email, title, body); err != nil {
				s.log.Warn("send email", "to", u.Email, "err", err)
			}
		}
		// Push (Expo) is best-effort; tokens are looked up per user.
		s.sendPush(ctx, u.ID, title, body)
	}
}

type recipient struct {
	ID    uuid.UUID
	Email string
}

func (s *Service) recipientsFor(ctx context.Context, event string, b bookings.BookingView) ([]recipient, error) {
	if event == "BOOKING_SUBMITTED" {
		var out []recipient
		for _, role := range []dbgen.UserRole{dbgen.UserRoleBOOKINGOFFICER, dbgen.UserRoleSYSTEMADMIN} {
			r := role
			users, err := s.store.ListUsers(ctx, dbgen.ListUsersParams{Role: &r, Lim: 200})
			if err != nil {
				return nil, err
			}
			for _, u := range users {
				out = append(out, recipient{ID: u.ID, Email: u.Email})
			}
		}
		return out, nil
	}
	// Requester-facing events.
	u, err := s.store.GetUserByID(ctx, b.RequestedBy)
	if err != nil {
		return nil, err
	}
	return []recipient{{ID: u.ID, Email: u.Email}}, nil
}

func (s *Service) sendPush(ctx context.Context, userID uuid.UUID, title, body string) {
	tokens, err := s.store.ListUserPushTokens(ctx, userID)
	if err != nil || len(tokens) == 0 {
		return
	}
	// Expo Push delivery is wired in the worker (ADR-0002); here we log intent so
	// the flow is observable without an outbound HTTP dependency in the API path.
	s.log.Info("push notification queued", "user", userID, "tokens", len(tokens), "title", title)
}

func renderBooking(event string, b bookings.BookingView) (title, body string) {
	// PART B: guard against a zero StartsAt so we never render "1 Jan 0001 00:00".
	// All booking flows construct the view from the stored tstzrange (starts_at/
	// ends_at) before dispatch; this is defence-in-depth for any future caller.
	when := "the requested time"
	if !b.StartsAt.IsZero() {
		when = b.StartsAt.Format("2 Jan 2006 15:04")
	}
	switch event {
	case "BOOKING_SUBMITTED":
		return "New booking request", fmt.Sprintf("A booking for %s has been requested: %s", when, b.Purpose)
	case "BOOKING_APPROVED":
		return "Booking approved", fmt.Sprintf("Your booking for %s has been approved.", when)
	case "BOOKING_REJECTED":
		return "Booking rejected", fmt.Sprintf("Your booking for %s was rejected.", when)
	case "BOOKING_CANCELLED":
		return "Booking cancelled", fmt.Sprintf("Your booking for %s was cancelled.", when)
	default:
		return "Booking update", fmt.Sprintf("Your booking for %s was updated.", when)
	}
}

// ── iam.Mailer ───────────────────────────────────────────────────────────────

// SendPasswordReset emails a reset link/token (§9.1). Best-effort; never reveals
// whether the address exists (the caller already enforces that).
func (s *Service) SendPasswordReset(ctx context.Context, email, rawToken string) error {
	body := fmt.Sprintf("Use this token to reset your password (valid for 1 hour):\n\n%s\n", rawToken)
	return s.mail.Send(ctx, email, "Reset your password", body)
}

// ── thin wrappers used by handlers ───────────────────────────────────────────

func (s *Service) List(ctx context.Context, p dbgen.ListNotificationsParams) ([]dbgen.Notification, error) {
	return s.store.ListNotifications(ctx, p)
}
func (s *Service) MarkRead(ctx context.Context, id, userID uuid.UUID) error {
	return s.store.MarkNotificationRead(ctx, dbgen.MarkNotificationReadParams{ID: id, UserID: userID})
}
func (s *Service) MarkAllRead(ctx context.Context, userID uuid.UUID) error {
	return s.store.MarkAllNotificationsRead(ctx, userID)
}
func (s *Service) Unread(ctx context.Context, userID uuid.UUID) (int64, error) {
	return s.store.CountUnread(ctx, userID)
}
func (s *Service) RegisterDevice(ctx context.Context, userID uuid.UUID, token string, platform *string) error {
	_, err := s.store.RegisterPushDevice(ctx, dbgen.RegisterPushDeviceParams{UserID: userID, ExpoToken: token, Platform: platform})
	return err
}
