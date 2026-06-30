import type { ColumnDef } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DataTable } from "@/components/data-table";

interface Row {
  name: string;
}

const columns: ColumnDef<Row>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
];

describe("DataTable", () => {
  it("paginates rows and moves between pages", async () => {
    const user = userEvent.setup();
    const data = Array.from({ length: 12 }, (_, index) => ({
      name: `Row ${index + 1}`,
    }));

    render(
      <DataTable
        columns={columns}
        data={data}
        caption="Rows"
        initialPageSize={5}
        pageSizeOptions={[5, 10]}
      />,
    );

    expect(screen.getByText("Row 1")).toBeInTheDocument();
    expect(screen.getByText("Row 5")).toBeInTheDocument();
    expect(screen.queryByText("Row 6")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Go to next page" }));

    expect(screen.queryByText("Row 1")).not.toBeInTheDocument();
    expect(screen.getByText("Row 6")).toBeInTheDocument();
    expect(screen.getByText("Row 10")).toBeInTheDocument();
  });
});
