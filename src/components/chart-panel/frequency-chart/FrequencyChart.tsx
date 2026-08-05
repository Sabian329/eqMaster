import { useFrequencyChart } from './useFrequencyChart';
import type { FrequencyChartProps } from '../types';

export function FrequencyChart({ series, fMin = 20, fMax = 20000 }: FrequencyChartProps) {
  const {
    canvasRef,
    wrapRef,
    tooltip,
    hasData,
    handleMouseMove,
    handleMouseLeave,
  } = useFrequencyChart(series, fMin, fMax);

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
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
          style={{ display: 'block', left: tooltip.left, top: tooltip.top }}
          dangerouslySetInnerHTML={{ __html: tooltip.html }}
        />
      )}
    </div>
  );
}
