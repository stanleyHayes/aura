// Package mailer abstracts transactional email (§7.8, §18.2). The transport is
// swappable: a logging mailer for dev, SMTP for self-host, or an API provider
// (Resend/Postmark/SES) in production behind the same interface.
package mailer

import (
	"context"
	"fmt"
	"log/slog"
	"net/smtp"
)

// Mailer sends a plain message. Implementations must not block the caller for
// long; dispatch happens off the request path (§7.8).
type Mailer interface {
	Send(ctx context.Context, to, subject, body string) error
}

// LogMailer writes emails to the logger — the default in development so flows are
// observable without an SMTP server (e.g. on Render before a provider is wired).
type LogMailer struct {
	log  *slog.Logger
	from string
}

func NewLogMailer(log *slog.Logger, from string) *LogMailer { return &LogMailer{log: log, from: from} }

func (m *LogMailer) Send(_ context.Context, to, subject, body string) error {
	m.log.Info("email (log mailer)", "from", m.from, "to", to, "subject", subject, "body", body)
	return nil
}

// SMTPMailer sends via SMTP (Mailpit in dev, or a provider relay in prod).
type SMTPMailer struct {
	addr string // host:port
	from string
	auth smtp.Auth
}

func NewSMTPMailer(host string, port int, from, user, pass string) *SMTPMailer {
	var auth smtp.Auth
	if user != "" {
		auth = smtp.PlainAuth("", user, pass, host)
	}
	return &SMTPMailer{addr: fmt.Sprintf("%s:%d", host, port), from: from, auth: auth}
}

func (m *SMTPMailer) Send(_ context.Context, to, subject, body string) error {
	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s\r\n",
		m.from, to, subject, body)
	return smtp.SendMail(m.addr, m.auth, m.from, []string{to}, []byte(msg))
}
