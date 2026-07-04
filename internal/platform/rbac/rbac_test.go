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
		// ADMIN merges the old timetable-admin + booking-officer duties:
		// approvals + read.any + reports + timetable, but no super-admin powers.
		{dbgen.UserRoleADMIN, BookingApprove, true},
		{dbgen.UserRoleADMIN, BookingReadAny, true},
		{dbgen.UserRoleADMIN, ReportView, true},
		{dbgen.UserRoleADMIN, TimetableManage, true},
		{dbgen.UserRoleADMIN, BookingCreate, true},
		{dbgen.UserRoleADMIN, UserManage, false},
		{dbgen.UserRoleADMIN, BookingOverride, false},
		{dbgen.UserRoleADMIN, AuditView, false},
		// SUPER_ADMIN ⊇ everything
		{dbgen.UserRoleSUPERADMIN, UserManage, true},
		{dbgen.UserRoleSUPERADMIN, RoomManage, true},
		{dbgen.UserRoleSUPERADMIN, SemesterManage, true},
		{dbgen.UserRoleSUPERADMIN, BookingOverride, true},
		{dbgen.UserRoleSUPERADMIN, MaintenanceManage, true},
		{dbgen.UserRoleSUPERADMIN, TimetableManage, true},
		{dbgen.UserRoleSUPERADMIN, AuditView, true},
		{dbgen.UserRoleSUPERADMIN, BookingApprove, true},
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
		dbgen.UserRoleREQUESTER, dbgen.UserRoleADMIN, dbgen.UserRoleSUPERADMIN,
	} {
		for _, p := range Permissions(role) {
			if !Can(role, Permission(p)) {
				t.Errorf("Permissions(%s) listed %q but Can() denies it", role, p)
			}
		}
	}
}
