"use client"

import { useState, useEffect } from "react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface SalinityChartProps {
  isLive: boolean
}

export function SalinityChart({ isLive }: SalinityChartProps) {
  const [data, setData] = useState([
    { location: "North Zone", salinity: 35.2, target: 35.0 },
    { location: "South Zone", salinity: 34.8, target: 35.0 },
    { location: "East Zone", salinity: 35.5, target: 35.0 },
    { location: "West Zone", salinity: 34.9, target: 35.0 },
    { location: "Central Zone", salinity: 35.1, target: 35.0 },
    { location: "Deep Zone", salinity: 34.7, target: 35.0 },
  ])

  useEffect(() => {
    if (!isLive) return

    const interval = setInterval(() => {
      setData((prevData) =>
        prevData.map((item) => ({
          ...item,
          salinity: Math.max(34.0, Math.min(36.0, item.salinity + (Math.random() - 0.5) * 0.3)),
        })),
      )
    }, 5000)

    return () => clearInterval(interval)
  }, [isLive])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Salinity Levels by Zone
          {isLive && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
        </CardTitle>
        <CardDescription>Current salinity measurements across monitoring zones (PSU)</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            salinity: {
              label: "Current Salinity (PSU)",
              color: "hsl(var(--chart-3))",
            },
            target: {
              label: "Target Level (PSU)",
              color: "hsl(var(--chart-4))",
            },
          }}
          className="h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="location" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={60} />
              <YAxis
                tick={{ fontSize: 12 }}
                domain={[33, 37]}
                label={{ value: "Salinity (PSU)", angle: -90, position: "insideLeft" }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Bar dataKey="salinity" fill="var(--color-salinity)" name="Current Salinity" radius={[2, 2, 0, 0]} />
              <Bar
                dataKey="target"
                fill="var(--color-target)"
                name="Target Level"
                radius={[2, 2, 0, 0]}
                opacity={0.4}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
