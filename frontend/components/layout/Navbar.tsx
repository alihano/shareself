import Link from "next/link";
import { WalletConnect } from "@/components/wallet/WalletConnect";
import { BalanceDisplay } from "@/components/wallet/BalanceDisplay";
import { MessagesNavLink, NotificationsNavLink } from "./NavLinkWithBadge";

const NAV_LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <span className="gradient-ring flex h-8 w-8 items-center justify-center rounded-xl text-sm text-white">
            S
          </span>
          <span className="gradient-text">ShareSelf</span>
        </Link>

        <nav className="flex flex-wrap items-center gap-5 text-sm font-medium text-muted">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
          <MessagesNavLink />
          <NotificationsNavLink />
        </nav>

        <div className="flex items-center gap-4">
          <BalanceDisplay />
          <WalletConnect />
        </div>
      </div>
    </header>
  );
}
