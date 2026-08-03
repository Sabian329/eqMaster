import { useEffect, useRef, useState } from 'react';
import { drawChart, nearestCurvePoint } from '../chart/drawChart';
import type { ChartBounds, ChartSeries } from '../types';
import { formatDb, formatFrequency } from '../utils/format';

interface FrequencyChartProps {
  series: ChartSeries[];
  fMin?: number;
  fMax?: number;
}

export function FrequencyChart({
  series,
  fMin = 20,
  fMax = 20000,
}: FrequencyChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const boundsRef = useRef<ChartBounds | null>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    left: number;
    top: number;
    html: string;
  }>({ visible: false, left: 0, top: 0, html: '' });

  const tooltipCurve =
    series.find((item) => item.id === 'average')?.curve ??
    series[series.length - 1]?.curve ??
    [];

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    boundsRef.current = drawChart(canvas, series, fMin, fMax);
  };

  useEffect(() => {
    redraw();
  }, [series, fMin, fMax]);

  useEffect(() => {
    const onResize = () => {
      window.clearTimeout((window as typeof window & { __roomEqResizeTimer?: number }).__roomEqResizeTimer);
      (window as typeof window & { __roomEqResizeTimer?: number }).__roomEqResizeTimer =
        window.setTimeout(redraw, 100);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [series, fMin, fMax]);

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const bounds = boundsRef.current;
    if (!canvas || !wrap || !bounds || !tooltipCurve.length) {
      setTooltip((t) => ({ ...t, visible: false }));
      return;
    }

    const point = nearestCurvePoint(tooltipCurve, event.clientX, canvas, bounds);
    if (!point) {
      setTooltip((t) => ({ ...t, visible: false }));
      return;
    }

    const wrapRect = wrap.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const x = bounds.xForFrequency(point.frequency);
    const y = bounds.yForDb(point.db);

    setTooltip({
      visible: true,
      left: canvasRect.left - wrapRect.left + x,
      top: canvasRect.top - wrapRect.top + y,
      html: `<strong>${formatFrequency(point.frequency)}</strong><br>${formatDb(point.db)}`,
    });
  };

  const hasData = series.some((item) => item.curve.length > 0);

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
      />
      {!hasData && (
        <div className="empty-state">
          <div>
            <strong>No measurement yet</strong>
            <br />
            Select devices, check levels, and run a sweep.
          </div>
        </div>
      )}
      {tooltip.visible && (
        <div
          className="tooltip"
          style={{
            display: 'block',
            left: tooltip.left,
            top: tooltip.top,
          }}
          dangerouslySetInnerHTML={{ __html: tooltip.html }}
        />
      )}
    </div>
  );
}
