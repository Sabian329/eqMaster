import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { drawChart, nearestCurvePoint } from '../../../chart/drawChart';
import type { FilterOverlay } from '../../../chart/drawFilterOverlays';
import type { ChartBounds, ChartSeries, Suggestion } from '../../../types';
import { frequencyAtCanvasX, isBandTooClose } from '../../../utils/customBands';
import { formatDb, formatFrequency } from '../../../utils/format';
import { buildTooltipHtml, lookupDbAtFrequency } from './utils';

export interface AddBandPopupState {
  visible: boolean;
  left: number;
  top: number;
  frequency: number;
  measuredDb: number;
  tooClose: boolean;
}

const HIDDEN_POPUP: AddBandPopupState = {
  visible: false,
  left: 0,
  top: 0,
  frequency: 0,
  measuredDb: 0,
  tooClose: false,
};

export function useFrequencyChart(
  series: ChartSeries[],
  fMin: number,
  fMax: number,
  suggestions: Suggestion[] = [],
  onAddCustomBand?: (frequency: number) => boolean,
  filterOverlays: FilterOverlay[] = [],
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const boundsRef = useRef<ChartBounds | null>(null);
  const [addBandPopup, setAddBandPopup] = useState<AddBandPopupState>(HIDDEN_POPUP);
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
    boundsRef.current = drawChart(canvas, series, fMin, fMax, {
      filterOverlays,
      frequencyGrid: measuredSeries?.curve ?? [],
    });
  }, [series, fMin, fMax, filterOverlays, measuredSeries?.curve]);

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
    if (addBandPopup.visible) return;
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

  const handleMouseLeave = () => {
    if (!addBandPopup.visible) {
      setTooltip((t) => ({ ...t, visible: false }));
    }
  };

  const handleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!onAddCustomBand) return;

    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const bounds = boundsRef.current;
    if (!canvas || !wrap || !bounds || !tooltipCurve.length) return;

    const frequency = frequencyAtCanvasX(event.clientX, canvas, bounds);
    const measuredDb = lookupDbAtFrequency(tooltipCurve, frequency) ?? 0;
    const wrapRect = wrap.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const x = bounds.xForFrequency(frequency);
    const y = bounds.yForDb(measuredDb);

    setTooltip((t) => ({ ...t, visible: false }));
    setAddBandPopup({
      visible: true,
      left: canvasRect.left - wrapRect.left + x,
      top: canvasRect.top - wrapRect.top + y,
      frequency,
      measuredDb,
      tooClose: isBandTooClose(frequency, suggestions),
    });
  };

  const closeAddBandPopup = useCallback(() => {
    setAddBandPopup(HIDDEN_POPUP);
  }, []);

  const confirmAddBand = useCallback(() => {
    if (!addBandPopup.visible || addBandPopup.tooClose || !onAddCustomBand) return;
    const added = onAddCustomBand(addBandPopup.frequency);
    if (added) {
      setAddBandPopup(HIDDEN_POPUP);
    }
  }, [addBandPopup, onAddCustomBand]);

  useEffect(() => {
    if (!addBandPopup.visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAddBandPopup();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [addBandPopup.visible, closeAddBandPopup]);

  const hasData = series.some((item) => item.curve.length > 0);

  return {
    canvasRef,
    wrapRef,
    tooltip,
    addBandPopup,
    hasData,
    handleMouseMove,
    handleMouseLeave,
    handleClick,
    closeAddBandPopup,
    confirmAddBand,
  };
}
