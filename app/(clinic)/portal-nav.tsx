'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  href: string
  label: string
}

const CLINIC_NAV_ITEMS: NavItem[] = [
  { href: '/clinic', label: 'Portal Home' },
  { href: '/clinic/new', label: 'New Work Order' },
  { href: '/cases', label: 'My Cases' },
]

function isActiveClinicRoute(pathname: string, href: string) {
  if (href === '/clinic') {
    return pathname === '/clinic'
  }

  if (href === '/clinic/new') {
    return pathname === '/clinic/new'
  }

  if (href === '/cases') {
    return pathname === '/cases' || pathname.startsWith('/cases/')
  }

  return pathname === href
}

export function ClinicPortalNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap gap-3">
      {CLINIC_NAV_ITEMS.map((item) => {
        const isActive = isActiveClinicRoute(pathname, item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              isActive
                ? 'bg-emerald-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
