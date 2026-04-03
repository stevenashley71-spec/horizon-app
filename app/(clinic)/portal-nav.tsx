'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { LogoutButton } from '@/app/components/logout-button'

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
  const isSubmittedScreen = pathname.startsWith('/clinic/submitted/')
  const submittedCaseId = pathname.split('/')[3] ?? ''
  const logoutClassName =
    'rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <nav className="flex flex-wrap gap-3">
      {CLINIC_NAV_ITEMS.map((item) => {
        const isActive = isActiveClinicRoute(pathname, item.href)
        const navHref = item.href
        const shouldIntercept = isSubmittedScreen
        const finalHref = shouldIntercept
          ? item.href === '/cases'
            ? `/clinic/submitted/${submittedCaseId}?pin=1&target=cases`
            : `/clinic/submitted/${submittedCaseId}?pin=1&target=dashboard`
          : navHref

        return (
          <Link
            key={item.href}
            href={finalHref}
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
      {isSubmittedScreen ? (
        <Link
          href={`/clinic/submitted/${submittedCaseId}?pin=1&target=dashboard`}
          className={logoutClassName}
        >
          Logout
        </Link>
      ) : (
        <LogoutButton loginPath="/clinic/login" className={logoutClassName} />
      )}
    </nav>
  )
}
