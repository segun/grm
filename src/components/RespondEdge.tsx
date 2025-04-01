/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react'
import { EdgeProps, getBezierPath } from 'reactflow'

import styles from './EdgeTypes.module.css'

export default function CustomEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
    data,
}: EdgeProps) {
    const [edgePath, edgeCenterX, edgeCenterY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    })

    return (
        <>
            <path
                id={id}
                style={style}
                className={`fill-none stroke-2 ${data?.isActive ? 'stroke-slate-400 ' : 'stroke-slate-300'}`}
                d={edgePath}
                markerEnd={markerEnd}
            />
        </>
    )
}
