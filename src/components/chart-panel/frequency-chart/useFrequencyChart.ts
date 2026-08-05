import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { drawChart, nearestCurvePoint } from '../../../chart/drawChart';
import type { ChartBounds, ChartSeries } from '../../../types';
import { formatDb, formatFrequency } from '../../../utils/format';
import { buildTooltipHtml, lookupDbAtFrequency } from './utils';

export function useFrequencyChart(
  series: ChartSeries[],
  fMin: number,
  fMax: number,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const boundsRef = useRef<ChartBounds | null>(null);
  const [tooltip, setTooltip] = useState({
    visible: false,
    left: 0,
    top: 0,
    html: '',
  });

  const measuredSeries =
    series.find((item) => item.id === 'average') ??
    series.find((item) => item.id.startsWith('run-')) ??
    series.find((item) => !['target', 'corrected'].includes(item.id));

  const correctedSeries = series.find((item) => item.id === 'corrected');
  const targetSeries = series.find((item) => item.id === 'target');
  const tooltipCurve = measuredSeries?.curve ?? [];

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    boundsRef.current = drawChart(canvas, series, fMin, fMax);
  }, [series, fMin, fMax]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    const onResize = () => {
      window.clearTimeout(
        (window as typeof window & { __roomEqResizeTimer?: number }).__roomEqResizeTimer,
      );
      (window as typeof window & { __roomEqResizeTimer?: number }).__roomEqResizeTimer =
        window.setTimeout(redraw, 100);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [redraw]);

  const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
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

    const correctedDb = correctedSeries
      ? lookupDbAtFrequency(correctedSeries.curve, point.frequency)
      : null;
    const targetDb = targetSeries
      ? lookupDbAtFrequency(targetSeries.curve, point.frequency)
      : null;

    setTooltip({
      visible: true,
      left: canvasRect.left - wrapRect.left + x,
      top: canvasRect.top - wrapRect.top + y,
      html: buildTooltipHtml(
        point.frequency,
        point.db,
        correctedDb,
        targetDb,
        formatFrequency,
        formatDb,
      ),
    });
  };

  const handleMouseLeave = () => setTooltip((t) => ({ ...t, visible: false }));

  const hasData = series.some((item) => item.curve.length > 0);

  return {
    canvasRef,
    wrapRef,
    tooltip,
    hasData,
    handleMouseMove,
    handleMouseLeave,
  };
}
