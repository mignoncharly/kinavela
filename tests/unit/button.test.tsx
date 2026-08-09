import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("keeps native accessible button semantics", () => {
    render(<Button type="button">Continue</Button>);
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });
});
