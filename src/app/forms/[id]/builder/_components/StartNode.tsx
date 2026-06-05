'use client'

import { Handle, Position } from '@xyflow/react'
import styles from '../builder.module.css'

export default function StartNode() {
  return (
    <div className={styles.startNode}>
      <div className={styles.nodeIcon}>▶</div>
      <div className={styles.nodeLabel}>Start</div>
      <Handle type="source" position={Position.Bottom} id="output" className={styles.handle} />
    </div>
  )
}
