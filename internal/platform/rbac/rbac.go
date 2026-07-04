// Package rbac centralises authorisation (§9.3, §9.4). Handlers declare the
// permission they require; this package resolves a role to its permission set.
// No role-name checks are scattered through business code.
package rbac

import "github.com/aura/cbs/internal/platform/db/dbgen"

type Permission string

const (
	UserManage         Permission = "user.manage"
	RoomManage         Permission = "room.manage"
	SemesterManage     Permission = "semester.manage"
	TimetableManage    Permission = "timetable.manage"
	BookingCreate      Permission = "booking.create"
	BookingReadAny     Permission = "booking.read.any"
	BookingReadOwn     Permission = "booking.read.own"
	BookingApprove     Permission = "booking.approve"
	BookingOverride    Permission = "booking.override"
	MaintenanceManage  Permission = "maintenance.manage"
	ReportView         Permission = "report.view"
	AvailabilitySearch Permission = "availability.search"
	AuditView          Permission = "audit.view"
)

// matrix is the §9.4 permission matrix. Permissions are additive by hierarchy:
// SUPER_ADMIN ⊇ ADMIN ⊇ REQUESTER. ADMIN merges the former timetable-admin and
// booking-officer duties: timetable management + booking approvals + reports.
var matrix = map[dbgen.UserRole]map[Permission]bool{
	dbgen.UserRoleREQUESTER: set(
		BookingCreate, BookingReadOwn, AvailabilitySearch,
	),
	dbgen.UserRoleADMIN: set(
		BookingCreate, BookingReadOwn, AvailabilitySearch,
		BookingReadAny, BookingApprove, ReportView,
		TimetableManage,
	),
	dbgen.UserRoleSUPERADMIN: set(
		BookingCreate, BookingReadOwn, AvailabilitySearch,
		BookingReadAny, BookingApprove, ReportView,
		TimetableManage,
		UserManage, RoomManage, SemesterManage, BookingOverride,
		MaintenanceManage, AuditView,
	),
}

func set(ps ...Permission) map[Permission]bool {
	m := make(map[Permission]bool, len(ps))
	for _, p := range ps {
		m[p] = true
	}
	return m
}

// Can reports whether a role holds a permission. Deny-by-default (§14 A01).
func Can(role dbgen.UserRole, p Permission) bool {
	perms, ok := matrix[role]
	if !ok {
		return false
	}
	return perms[p]
}

// Permissions returns the full permission set for a role (for /auth/me).
func Permissions(role dbgen.UserRole) []string {
	perms := matrix[role]
	out := make([]string, 0, len(perms))
	for p := range perms {
		out = append(out, string(p))
	}
	return out
}
