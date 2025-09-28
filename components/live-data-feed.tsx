"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Activity, AlertTriangle, CheckCircle } from "lucide-react"

interface DataPoint {
  id: string
  timestamp: Date
  sensor: string
  type: "temperature" | "salinity" | "depth" | "pressure"
  value: number
  unit: string
  status: "normal" | "warning" | "critical"
}

interface LiveDataFeedProps {
  isLive: boolean
  lastUpdate: Date
}

export function LiveDataFeed({ isLive, lastUpdate }: LiveDataFeedProps) {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([
    {
      id: "1",
      timestamp: new Date(Date.now() - 1000),
      sensor: "Sensor A1",
      type: "temperature",
      value: 18.4,
      unit: "°C",
      status: "normal",
    },
    {
      id: "2",
      timestamp: new Date(Date.now() - 2000),
      sensor: "Sensor B2",
      type: "salinity",
      value: 35.2,
      unit: "PSU",
      status: "normal",
    },
    {
      id: "3",
      timestamp: new Date(Date.now() - 3000),
      sensor: "Sensor C3",
      type: "depth",
      value: 1250,
      unit: "m",
      status: "normal",
    },
  ])

  useEffect(() => {
    if (!isLive) return

    const interval = setInterval(() => {
      const sensors = ["Sensor A1", "Sensor B2", "Sensor C3", "Sensor D4", "Sensor E5"]
      const types: Array<DataPoint["type"]> = ["temperature", "salinity", "depth", "pressure"]
      const units = { temperature: "°C", salinity: "PSU", depth: "m", pressure: "bar" }

      const newDataPoint: DataPoint = {
        id: Date.now().toString(),
        timestamp: new Date(),
        sensor: sensors[Math.floor(Math.random() * sensors.length)],
        type: types[Math.floor(Math.random() * types.length)],
        value: 0,
        unit: "",
        status: Math.random() > 0.9 ? "warning" : "normal",
      }

      // Generate realistic values based on type
      switch (newDataPoint.type) {
        case "temperature":
          newDataPoint.value = Math.round((15 + Math.random() * 10) * 10) / 10
          break
        case "salinity":
          newDataPoint.value = Math.round((34 + Math.random() * 2) * 10) / 10
          break
        case "depth":
          newDataPoint.value = Math.round(500 + Math.random() * 2000)
          break
        case "pressure":
          newDataPoint.value = Math.round((50 + Math.random() * 200) * 10) / 10
          break
      }

      newDataPoint.unit = units[newDataPoint.type]

      setDataPoints((prev) => [newDataPoint, ...prev.slice(0, 19)]) // Keep last 20 entries
    }, 3000)

    return () => clearInterval(interval)
  }, [isLive, lastUpdate])

  const getStatusIcon = (status: DataPoint["status"]) => {
    switch (status) {
      case "normal":
        return <CheckCircle className="h-3 w-3 text-green-500" />
      case "warning":
        return <AlertTriangle className="h-3 w-3 text-yellow-500" />
      case "critical":
        return <AlertTriangle className="h-3 w-3 text-red-500" />
    }
  }

  const getStatusColor = (status: DataPoint["status"]) => {
    switch (status) {
      case "normal":
        return "bg-green-500/10 text-green-700 border-green-200"
      case "warning":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-200"
      case "critical":
        return "bg-red-500/10 text-red-700 border-red-200"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Live Data Feed
          {isLive && <Activity className="h-4 w-4 text-green-500 animate-pulse" />}
        </CardTitle>
        <CardDescription>Real-time sensor data ingestion stream</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {dataPoints.map((point, index) => (
              <div key={point.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1">
                    {getStatusIcon(point.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{point.sensor}</span>
                        <Badge variant="outline" className={`text-xs ${getStatusColor(point.status)}`}>
                          {point.type}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold text-primary">
                          {point.value} {point.unit}
                        </span>
                        <span className="text-xs text-muted-foreground">{point.timestamp.toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {index < dataPoints.length - 1 && <Separator className="mt-3" />}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
