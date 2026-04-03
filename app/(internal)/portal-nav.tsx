'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { LogoutButton } from '@/app/components/logout-button'
import type { UserRole } from '@/lib/auth/get-user-role'

type NavItem = {
  href: string
  label: string
}

const INTERNAL_NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/workroom', label: 'Workroom' },
  { href: '/pickup', label: 'Pickup' },
  { href: '/returns', label: 'Returns' },
  { href: '/scan', label: 'Scan' },
  { href: '/cases', label: 'Cases' },
]

function isActiveInternalRoute(pathname: string, href: string) {
  if (href.startsWith('/admin')) {
    return pathname.startsWith('/admin/')
  }

  if (href === '/cases') {
    return pathname === '/cases' || pathname.startsWith('/cases/')
  }

  return pathname === href
}

export function InternalPortalNav({ userRole }: { userRole: UserRole }) {
  const pathname = usePathname()
  const navItems =
    userRole === 'admin'
      ? [...INTERNAL_NAV_ITEMS, { href: '/admin/clinics', label: 'Admin' }]
      : INTERNAL_NAV_ITEMS

  return (
    <nav className="flex flex-wrap gap-3">
      {navItems.map((item) => {
        const isActive = isActiveInternalRoute(pathname, item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              isActive
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
      <LogoutButton
        loginPath="/admin/login"
        className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </nav>
  )
}
