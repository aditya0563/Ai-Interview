/**
 * packages/ui — Card, CardHeader, CardBody component tests
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardBody } from "./card";

// ═══════════════════════════════════════════════════════════════════════════
// Card
// ═══════════════════════════════════════════════════════════════════════════

describe("Card", () => {
  it("renders children inside the card wrapper", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("applies the base styling classes", () => {
    const { container } = render(<Card>Inner</Card>);
    const div = container.firstElementChild!;
    expect(div.className).toContain("rounded-xl");
    expect(div.className).toContain("border-gray-200");
    expect(div.className).toContain("bg-white");
    expect(div.className).toContain("shadow-sm");
  });

  it("appends a custom className", () => {
    const { container } = render(<Card className="mt-4">Content</Card>);
    expect(container.firstElementChild!.className).toContain("mt-4");
  });

  it("does not lose base classes when a custom className is provided", () => {
    const { container } = render(<Card className="extra">Content</Card>);
    expect(container.firstElementChild!.className).toContain("rounded-xl");
    expect(container.firstElementChild!.className).toContain("extra");
  });

  it("renders as a <div> element", () => {
    const { container } = render(<Card>Test</Card>);
    expect(container.firstElementChild!.tagName).toBe("DIV");
  });

  it("renders complex nested children", () => {
    render(
      <Card>
        <span data-testid="child-a">A</span>
        <span data-testid="child-b">B</span>
      </Card>
    );
    expect(screen.getByTestId("child-a")).toBeInTheDocument();
    expect(screen.getByTestId("child-b")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CardHeader
// ═══════════════════════════════════════════════════════════════════════════

describe("CardHeader", () => {
  it("renders children", () => {
    render(<CardHeader>My Title</CardHeader>);
    expect(screen.getByText("My Title")).toBeInTheDocument();
  });

  it("applies border-b and padding classes", () => {
    const { container } = render(<CardHeader>Header</CardHeader>);
    const div = container.firstElementChild!;
    expect(div.className).toContain("border-b");
    expect(div.className).toContain("px-6");
    expect(div.className).toContain("py-4");
  });

  it("appends a custom className without losing base classes", () => {
    const { container } = render(
      <CardHeader className="font-bold">Header</CardHeader>
    );
    const div = container.firstElementChild!;
    expect(div.className).toContain("border-b");
    expect(div.className).toContain("font-bold");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CardBody
// ═══════════════════════════════════════════════════════════════════════════

describe("CardBody", () => {
  it("renders children", () => {
    render(<CardBody>Body content</CardBody>);
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("applies padding classes", () => {
    const { container } = render(<CardBody>Body</CardBody>);
    const div = container.firstElementChild!;
    expect(div.className).toContain("px-6");
    expect(div.className).toContain("py-4");
  });

  it("appends a custom className without losing base classes", () => {
    const { container } = render(
      <CardBody className="overflow-y-auto">Body</CardBody>
    );
    const div = container.firstElementChild!;
    expect(div.className).toContain("px-6");
    expect(div.className).toContain("overflow-y-auto");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Composition — Card + CardHeader + CardBody together
// ═══════════════════════════════════════════════════════════════════════════

describe("Card composition", () => {
  it("renders a complete card with header and body", () => {
    render(
      <Card>
        <CardHeader>Interview Summary</CardHeader>
        <CardBody>Score: 92/100</CardBody>
      </Card>
    );
    expect(screen.getByText("Interview Summary")).toBeInTheDocument();
    expect(screen.getByText("Score: 92/100")).toBeInTheDocument();
  });

  it("maintains structural nesting", () => {
    const { container } = render(
      <Card>
        <CardHeader>H</CardHeader>
        <CardBody>B</CardBody>
      </Card>
    );
    const card = container.firstElementChild!;
    expect(card.children).toHaveLength(2);
    // First child is CardHeader (has border-b)
    expect(card.children[0]!.className).toContain("border-b");
    // Second child is CardBody (no border-b)
    expect(card.children[1]!.className).not.toContain("border-b");
  });
});
