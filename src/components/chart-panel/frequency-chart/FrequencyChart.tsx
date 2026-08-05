import { useFrequencyChart } from './useFrequencyChart';
import { AddBandPopup } from './AddBandPopup';
import type { FrequencyChartProps } from '../types';

export function FrequencyChart({
  series,
  fMin = 20,
  fMax = 20000,
  suggestions = [],
  filterOverlays = [],
  onAddCustomBand,
}: FrequencyChartProps) {
  const {
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
  } = useFrequencyChart(
    series,
    fMin,
    fMax,
    suggestions,
    onAddCustomBand,
    filterOverlays,
  );

  return (
    <div className={`chart-wrap${onAddCustomBand ? ' chart-wrap--interactive' : ''}`} ref={wrapRef}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
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
      {tooltip.visible && !addBandPopup.visible && (
        <div
          className="tooltip"
          style={{ display: 'block', left: tooltip.left, top: tooltip.top }}
          dangerouslySetInnerHTML={{ __html: tooltip.html }}
        />
      )}
      {addBandPopup.visible && (
        <AddBandPopup
          frequency={addBandPopup.frequency}
          measuredDb={addBandPopup.measuredDb}
          left={addBandPopup.left}
          top={addBandPopup.top}
          tooClose={addBandPopup.tooClose}
          onAdd={confirmAddBand}
          onClose={closeAddBandPopup}
        />
      )}
    </div>
  );
}
