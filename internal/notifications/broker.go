package notifications

import (
	"errors"
	"sync"

	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/db/dbgen"
)

// maxStreamsPerUser bounds the number of concurrent SSE subscriptions a single
// user may hold, so one account cannot exhaust server connections/goroutines
// (MED-6, §14 DoS).
const maxStreamsPerUser = 5

// ErrTooManyStreams is returned by Subscribe when a user is already at the
// per-user stream cap. The SSE handler maps it to HTTP 429.
var ErrTooManyStreams = errors.New("too many concurrent notification streams for user")

// Broker is an in-process pub/sub used to push live in-app notifications over SSE
// (§7.8). It is single-instance; for multiple API replicas, swap this for Redis
// pub/sub behind the same Subscribe/Publish surface (ADR-0002, §15). Non-blocking:
// a slow subscriber drops messages rather than stalling the publisher.
type Broker struct {
	mu   sync.RWMutex
	subs map[uuid.UUID]map[int]chan dbgen.Notification
	next int
}

func NewBroker() *Broker {
	return &Broker{subs: make(map[uuid.UUID]map[int]chan dbgen.Notification)}
}

// Subscribe returns a channel of notifications for a user and an unsubscribe func.
// It rejects the subscription with ErrTooManyStreams once the user is at the
// per-user concurrent-stream cap (MED-6).
func (b *Broker) Subscribe(userID uuid.UUID) (<-chan dbgen.Notification, func(), error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.subs[userID] == nil {
		b.subs[userID] = make(map[int]chan dbgen.Notification)
	}
	if len(b.subs[userID]) >= maxStreamsPerUser {
		return nil, nil, ErrTooManyStreams
	}
	id := b.next
	b.next++
	ch := make(chan dbgen.Notification, 16)
	b.subs[userID][id] = ch
	return ch, func() {
		b.mu.Lock()
		defer b.mu.Unlock()
		if m, ok := b.subs[userID]; ok {
			if c, ok := m[id]; ok {
				close(c)
				delete(m, id)
			}
			if len(m) == 0 {
				delete(b.subs, userID)
			}
		}
	}, nil
}

// Publish delivers a notification to all of a user's subscribers, dropping it for
// any subscriber whose buffer is full.
func (b *Broker) Publish(n dbgen.Notification) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for _, ch := range b.subs[n.UserID] {
		select {
		case ch <- n:
		default: // subscriber is slow; drop rather than block
		}
	}
}
