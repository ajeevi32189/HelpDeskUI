import { Construction } from 'lucide-react'
import { Card } from '../components/ui'

export default function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <Card className="mt-6 grid place-items-center px-6 py-20 text-center">
        <Construction className="size-10 text-subtle" />
        <p className="mt-4 font-medium">This page is coming in a future release.</p>
        <p className="mt-1 text-sm text-subtle">We are focusing on sign-in and the ticket list first.</p>
      </Card>
    </div>
  )
}
