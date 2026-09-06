import { useRef, type ComponentProps } from 'react'
import { CopyButton } from './CopyButton'

type Props = ComponentProps<'pre'> & { 'data-filename'?: string }

export function CodeBlock({ 'data-filename': filename, className, ...rest }: Props) {
  const ref = useRef<HTMLPreElement>(null)
  return (
    <div className="group relative">
      {filename && (
        <div className="absolute left-3 top-2 font-mono text-[11px] text-muted">{filename}</div>
      )}
      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
        <CopyButton getText={() => ref.current?.textContent ?? ''} />
      </div>
      <pre ref={ref} className={[className, filename ? 'pt-8!' : ''].join(' ')} {...rest} />
    </div>
  )
}
