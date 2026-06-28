import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, buttonVariants } from "@cbs/ui/components/button";

/**
 * Render tests for the shared Button. They exercise the real component (variant
 * classes, `asChild` slot composition, and click handling) rather than mocking
 * it.
 */

describe("Button", () => {
  it("renders its children as a native button by default", () => {
    render(<Button>Submit request</Button>);
    const btn = screen.getByRole("button", { name: "Submit request" });
    expect(btn).toBeInTheDocument();
    expect(btn.tagName).toBe("BUTTON");
  });

  it("applies the default variant + size classes", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveClass(
      ...buttonVariants({ variant: "default", size: "default" }).split(" "),
    );
  });

  it("forwards arbitrary props and the disabled attribute", () => {
    render(
      <Button disabled type="submit">
        Save
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("type", "submit");
  });

  it("calls onClick when activated", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Approve</Button>);
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders as a link element when asChild is set (Slot composition)", () => {
    render(
      <Button asChild>
        <a href="https://example.com/docs">View docs</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "View docs" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://example.com/docs");
    // asChild composes onto the child element rather than rendering a <button>.
    expect(link.tagName).toBe("A");
  });
});
