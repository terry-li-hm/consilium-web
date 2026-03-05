'use client'
import dynamic from 'next/dynamic'

const AuthButton = dynamic(
  () => import('@/components/AuthButton').then(m => m.AuthButton),
  { ssr: false }
)

export { AuthButton }
