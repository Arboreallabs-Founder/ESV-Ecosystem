'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import styles from '../builder.module.css'

export default function EndNode({ data }: NodeProps) {
  const subtype = (data as any).subtype as 'success' | 'rejected' | null
  const isRejected = subtype === 'rejected'
  return (
    <div className={`${styles.endNode} ${isRejected ? styles.endNodeRejected : styles.endNodeSuccess}`}>
      <Handle type="target" position={Position.Top} id="input" className={styles.handle} />
      <div className={styles.nodeIcon}>{isRejected ? '✕' : '✓'}</div>
      <div className={styles.nodeLabel}>{isRejected ? 'Not Eligible' : 'Submitted'}</div>
    </div>
  )
}
