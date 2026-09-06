import type { ComponentProps } from 'react'
import type { MDXComponents } from 'mdx/types'
import { CodeBlock } from './CodeBlock'

export const mdxComponents: MDXComponents = {
  pre: (props) => <CodeBlock {...(props as ComponentProps<'pre'>)} />,
}
