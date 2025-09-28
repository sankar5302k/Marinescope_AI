"use client"

import { useState, useEffect } from "react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface DepthChartProps {
  isLive: boolean
}

export function DepthChart({ isLive }: DepthChartProps) {
  const [data, setData] = useState([
    { sensor: "Sensor A1", depth: 1250, status: "active", pressure: 125.2 },
    { sensor: "Sensor B2", depth: 2100, status: "active", pressure: 210.5 },
    { sensor: "Sensor C3", depth: 850, status: "active", pressure: 85.1 },
    { sensor: "Sensor D4", depth: 1800, status: "active", pressure: 180.3 },
    { sensor: "Sensor E5", depth: 2847, status: "active", pressure: 284.9 },
    { sensor: "Sensor F6", depth: 1450, status: "active", pressure: 145.2 },
    { sensor: "Sensor G7", depth: 950, status: "active", pressure: 95.4 },
    { sensor: "Sensor H8", depth: 2200, status: "active", pressure: 220.1 },
  ])

  useEffect(() => {
    if (!isLive) return

    const interval = setInterval(() => {
      setData((prevData) =>
        prevData.map((item) => ({
          ...item,
          depth: Math.max(500, item.depth + (Math.random() - 0.5) * 50),
          pressure: Math.max(50, item.pressure + (Math.random() - 0.5) * 5),
        })),
      )
    }, 5000)

    return () => clearInterval(interval)
  }, [isLive])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Sensor Depth Distribution
          {isLive && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
        </CardTitle>
        <CardDescription>Current depth readings from active monitoring sensors</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            depth: {
              label: "Depth (meters)",
              color: "hsl(var(--chart-5))",
            },
          }}
          className="h-[350px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="sensor" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 12 }} label={{ value: "Depth (m)", angle: -90, position: "insideLeft" }} />
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value, name) => [`${value}m`, name === "depth" ? "Depth" : name]}
              />
              <Bar dataKey="depth" fill="var(--color-depth)" name="Depth" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
