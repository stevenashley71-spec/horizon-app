'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type AdminNavItem = {
  href: string
  label: string
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/clinics', label: 'Clinics' },
  { href: '/admin/clinic-products', label: 'Clinic Products' },
  { href: '/admin/staff', label: 'Staff' },
  { href: '/admin/workflow', label: 'Workflow' },
]

export function AdminSubnav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap gap-3">
      {ADMIN_NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href

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
    </nav>
  )
}
