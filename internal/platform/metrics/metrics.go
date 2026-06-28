// Package metrics registers domain Prometheus metrics on the default registry
// (scraped at /metrics; §15). Collectors are process-global, so call sites use
// the package-level helpers without dependency injection.
package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	bookingsCreated = promauto.NewCounter(prometheus.CounterOpts{
		Name: "cbs_bookings_created_total", Help: "Booking requests submitted.",
	})
	bookingsApproved = promauto.NewCounter(prometheus.CounterOpts{
		Name: "cbs_bookings_approved_total", Help: "Bookings approved.",
	})
	bookingsRejected = promauto.NewCounter(prometheus.CounterOpts{
		Name: "cbs_bookings_rejected_total", Help: "Bookings rejected.",
	})
	bookingsCancelled = promauto.NewCounter(prometheus.CounterOpts{
		Name: "cbs_bookings_cancelled_total", Help: "Bookings cancelled.",
	})
	availabilitySearch = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "cbs_availability_search_seconds",
		Help:    "Availability search latency (server-side).",
		Buckets: []float64{0.01, 0.05, 0.1, 0.3, 0.5, 1, 3},
	})
	importsProcessed = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "cbs_timetable_imports_total", Help: "Timetable imports by final status.",
	}, []string{"status"})
)

func BookingCreated()   { bookingsCreated.Inc() }
func BookingApproved()  { bookingsApproved.Inc() }
func BookingRejected()  { bookingsRejected.Inc() }
func BookingCancelled() { bookingsCancelled.Inc() }

func ObserveAvailabilitySearch(seconds float64) { availabilitySearch.Observe(seconds) }

func ImportProcessed(status string) { importsProcessed.WithLabelValues(status).Inc() }
