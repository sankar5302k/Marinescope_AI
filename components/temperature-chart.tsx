"use client"

import { useState, useEffect } from "react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface TemperatureChartProps {
  isLive: boolean
}

export function TemperatureChart({ isLive }: TemperatureChartProps) {
  const [data, setData] = useState([
    { depth: "0-50m", temperature: 22.5, previous: 21.8 },
    { depth: "50-100m", temperature: 18.3, previous: 18.1 },
    { depth: "100-200m", temperature: 15.7, previous: 15.9 },
    { depth: "200-500m", temperature: 12.4, previous: 12.2 },
    { depth: "500-1000m", temperature: 8.9, previous: 9.1 },
    { depth: "1000m+", temperature: 4.2, previous: 4.0 },
  ])

  useEffect(() => {
    if (!isLive) return

    const interval = setInterval(() => {
      setData((prevData) =>
        prevData.map((item) => ({
          ...item,
          previous: item.temperature,
          temperature: item.temperature + (Math.random() - 0.5) * 0.8,
        })),
      )
    }, 5000)

    return () => clearInterval(interval)
  }, [isLive])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Temperature Distribution by Depth
          {isLive && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
        </CardTitle>
        <CardDescription>Current water temperature readings across different depth zones</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            temperature: {
              label: "Current Temperature (°C)",
              color: "hsl(var(--chart-1))",
            },
            previous: {
              label: "Previous Reading (°C)",
              color: "hsl(var(--chart-2))",
            },
          }}
          className="h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="depth" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={60} />
              <YAxis
                tick={{ fontSize: 12 }}
                label={{ value: "Temperature (°C)", angle: -90, position: "insideLeft" }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Bar
                dataKey="temperature"
                fill="var(--color-temperature)"
                name="Current Temperature"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="previous"
                fill="var(--color-previous)"
                name="Previous Reading"
                radius={[2, 2, 0, 0]}
                opacity={0.6}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
