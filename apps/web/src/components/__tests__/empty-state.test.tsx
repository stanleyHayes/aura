import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarRange } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

/**
 * EmptyState is a presentational web component. These render the real component
 * and assert the conditional rendering of description + action.
 */

describe("EmptyState", () => {
  it("renders the icon, title and description", () => {
    render(
      <EmptyState
        icon={CalendarRange}
        title="No bookings yet"
        description="Your approved bookings will appear here."
      />,
    );
    expect(
      screen.getByRole("heading", { name: "No bookings yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your approved bookings will appear here."),
    ).toBeInTheDocument();
  });

  it("omits the description and action when not provided", () => {
    render(<EmptyState icon={CalendarRange} title="Nothing here" />);
    expect(screen.getByRole("heading", { name: "Nothing here" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a provided action node", () => {
    render(
      <EmptyState
        icon={CalendarRange}
        title="No rooms"
        action={<button type="button">Add a room</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Add a room" })).toBeInTheDocument();
  });
});
