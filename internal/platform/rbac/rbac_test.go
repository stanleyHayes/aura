package rbac

import (
	"testing"

	"github.com/aura/cbs/internal/platform/db/dbgen"
)

func TestCanMatrix(t *testing.T) {
	cases := []struct {
		role dbgen.UserRole
		perm Permission
		want bool
	}{
		// REQUESTER
		{dbgen.UserRoleREQUESTER, BookingCreate, true},
		{dbgen.UserRoleREQUESTER, AvailabilitySearch, true},
		{dbgen.UserRoleREQUESTER, BookingReadOwn, true},
		{dbgen.UserRoleREQUESTER, BookingReadAny, false},
		{dbgen.UserRoleREQUESTER, BookingApprove, false},
		{dbgen.UserRoleREQUESTER, UserManage, false},
		// BOOKING_OFFICER ⊇ REQUESTER + approve/read.any/report
		{dbgen.UserRoleBOOKINGOFFICER, BookingApprove, true},
		{dbgen.UserRoleBOOKINGOFFICER, BookingReadAny, true},
		{dbgen.UserRoleBOOKINGOFFICER, ReportView, true},
		{dbgen.UserRoleBOOKINGOFFICER, BookingCreate, true},
		{dbgen.UserRoleBOOKINGOFFICER, UserManage, false},
		{dbgen.UserRoleBOOKINGOFFICER, BookingOverride, false},
		{dbgen.UserRoleBOOKINGOFFICER, TimetableManage, false},
		// TIMETABLE_ADMIN is orthogonal: timetable + requester perms, no approvals
		{dbgen.UserRoleTIMETABLEADMIN, TimetableManage, true},
		{dbgen.UserRoleTIMETABLEADMIN, BookingCreate, true},
		{dbgen.UserRoleTIMETABLEADMIN, BookingApprove, false},
		{dbgen.UserRoleTIMETABLEADMIN, UserManage, false},
		// SYSTEM_ADMIN ⊇ everything
		{dbgen.UserRoleSYSTEMADMIN, UserManage, true},
		{dbgen.UserRoleSYSTEMADMIN, RoomManage, true},
		{dbgen.UserRoleSYSTEMADMIN, SemesterManage, true},
		{dbgen.UserRoleSYSTEMADMIN, BookingOverride, true},
		{dbgen.UserRoleSYSTEMADMIN, MaintenanceManage, true},
		{dbgen.UserRoleSYSTEMADMIN, TimetableManage, true},
		{dbgen.UserRoleSYSTEMADMIN, AuditView, true},
		{dbgen.UserRoleSYSTEMADMIN, BookingApprove, true},
	}
	for _, c := range cases {
		if got := Can(c.role, c.perm); got != c.want {
			t.Errorf("Can(%s, %s) = %v, want %v", c.role, c.perm, got, c.want)
		}
	}
}

func TestDenyByDefaultUnknownRole(t *testing.T) {
	if Can(dbgen.UserRole("GHOST"), BookingCreate) {
		t.Fatal("unknown role must be denied by default")
	}
}

func TestPermissionsListMatchesCan(t *testing.T) {
	for _, role := range []dbgen.UserRole{
		dbgen.UserRoleREQUESTER, dbgen.UserRoleBOOKINGOFFICER, dbgen.UserRoleTIMETABLEADMIN, dbgen.UserRoleSYSTEMADMIN,
	} {
		for _, p := range Permissions(role) {
			if !Can(role, Permission(p)) {
				t.Errorf("Permissions(%s) listed %q but Can() denies it", role, p)
			}
		}
	}
}
