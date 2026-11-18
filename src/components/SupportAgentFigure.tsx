import { cx } from './ui'

interface SupportAgentFigureProps {
  className?: string
}

export function SupportAgentFigure({ className }: SupportAgentFigureProps) {
  return (
    <div className={cx('support-figure relative isolate shrink-0', className)}>
      <img
        src="/support-agent-banner-blue.png"
        alt="Support agent wearing a headset with helpdesk ticket cards"
        className="size-full object-contain"
      />
    </div>
  )
}
