import React from 'react';

interface EquityGaugeProps {
  rawEquity: number; // e.g. 0.42 -> 42%
  realizedEquity: number; // e.g. 0.31 -> 31%
  size?: number;
}

export const EquityGauge: React.FC<EquityGaugeProps> = ({
  rawEquity,
  realizedEquity,
  size = 180,
}) => {
  const rawPct = Math.round(rawEquity * 100);
  const realizedPct = Math.round(realizedEquity * 100);
  const penalty = realizedPct - rawPct; // negative if realized < raw

  const strokeWidth = 14;
  const center = size / 2;
  const outerRadius = center - strokeWidth;
  const innerRadius = outerRadius - strokeWidth - 4;

  const outerCircumference = 2 * Math.PI * outerRadius;
  const innerCircumference = 2 * Math.PI * innerRadius;

  // Arc length (270 degree gauge, starting from 135 deg to 405 deg)
  const gaugeAngle = 270;
  const angleRad = (gaugeAngle / 360);
  const outerGaugeLen = outerCircumference * angleRad;
  const innerGaugeLen = innerCircumference * angleRad;

  const outerStrokeDash = (rawPct / 100) * outerGaugeLen;
  const innerStrokeDash = (realizedPct / 100) * innerGaugeLen;

  return (
    <div className="equity-gauge-container">
      <div className="equity-gauge-svg-wrapper">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background Arcs */}
          <circle
            cx={center}
            cy={center}
            r={outerRadius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${outerGaugeLen} ${outerCircumference}`}
            transform={`rotate(135 ${center} ${center})`}
            strokeLinecap="round"
          />
          <circle
            cx={center}
            cy={center}
            r={innerRadius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${innerGaugeLen} ${innerCircumference}`}
            transform={`rotate(135 ${center} ${center})`}
            strokeLinecap="round"
          />

          {/* Raw Equity Arc (Cyan) */}
          <circle
            cx={center}
            cy={center}
            r={outerRadius}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={strokeWidth}
            strokeDasharray={`${outerStrokeDash} ${outerCircumference}`}
            transform={`rotate(135 ${center} ${center})`}
            strokeLinecap="round"
            className="gauge-arc-transition"
          />

          {/* Realized Equity Arc (Emerald Green) */}
          <circle
            cx={center}
            cy={center}
            r={innerRadius}
            fill="none"
            stroke="#10b981"
            strokeWidth={strokeWidth}
            strokeDasharray={`${innerStrokeDash} ${innerCircumference}`}
            transform={`rotate(135 ${center} ${center})`}
            strokeLinecap="round"
            className="gauge-arc-transition"
          />
        </svg>

        {/* Center Labels */}
        <div className="equity-gauge-center-text">
          <span className="gauge-realized-val">{realizedPct}%</span>
          <span className="gauge-realized-label">Realized</span>
          <span className={`gauge-penalty-tag ${penalty < 0 ? 'penalty-neg' : 'penalty-pos'}`}>
            {penalty >= 0 ? `+${penalty}%` : `${penalty}%`} Delta
          </span>
        </div>
      </div>

      <div className="equity-gauge-legend">
        <div className="legend-item">
          <span className="legend-dot cyan" />
          <span className="legend-label">Raw Equity</span>
          <span className="legend-val">{rawPct}%</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot emerald" />
          <span className="legend-label">Realized Equity</span>
          <span className="legend-val">{realizedPct}%</span>
        </div>
      </div>
    </div>
  );
};
