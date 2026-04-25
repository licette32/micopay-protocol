import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import LoginPage from "./LoginPage";

const noop = () => {};

vi.mock("../services/api", () => ({
  demoLogin: vi.fn(),
}));

describe("LoginPage — credential prefill", () => {
  it("renders pre-filled demo stellar address when isDemoMode=true", () => {
    render(<LoginPage isDemoMode={true} onLogin={noop} />);
    const input = screen.getByTestId(
      "demo-stellar-address",
    ) as HTMLInputElement;
    expect(input.value).toBe(
      "GDEMOREVIEWER1111111111111111111111111111111111111111111111",
    );
  });

  it("renders pre-filled demo password when isDemoMode=true", () => {
    render(<LoginPage isDemoMode={true} onLogin={noop} />);
    const input = screen.getByTestId("demo-password") as HTMLInputElement;
    expect(input.value).toBe("MicoPay-Review-2025");
  });

  it("shows the review-purposes label when isDemoMode=true", () => {
    render(<LoginPage isDemoMode={true} onLogin={noop} />);
    expect(screen.getByTestId("demo-credentials-label")).toBeInTheDocument();
    expect(
      screen.getByText(/Demo credentials.*App Store review only/i),
    ).toBeInTheDocument();
  });

  it("shows the demo login button when isDemoMode=true", () => {
    render(<LoginPage isDemoMode={true} onLogin={noop} />);
    expect(screen.getByTestId("demo-login-button")).toBeInTheDocument();
  });

  it("renders empty stellar address field when isDemoMode=false", () => {
    render(<LoginPage isDemoMode={false} onLogin={noop} />);
    const input = screen.getByTestId(
      "stellar-address-input",
    ) as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("renders empty password field when isDemoMode=false", () => {
    render(<LoginPage isDemoMode={false} onLogin={noop} />);
    const input = screen.getByTestId("password-input") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("hides the demo credentials label when isDemoMode=false", () => {
    render(<LoginPage isDemoMode={false} onLogin={noop} />);
    expect(
      screen.queryByTestId("demo-credentials-label"),
    ).not.toBeInTheDocument();
  });

  it("hides the demo login button when isDemoMode=false", () => {
    render(<LoginPage isDemoMode={false} onLogin={noop} />);
    expect(screen.queryByTestId("demo-login-button")).not.toBeInTheDocument();
  });
});
