import { roomOf, type PalaceModel, type RoomVisual } from "@/lib/palace"

function Dust({
  points,
  room,
}: {
  points: Array<[number, number]>
  room: RoomVisual
}) {
  if (!room.dust || room.stage === 0) return null
  return (
    <g>
      {points.map(([x, y], index) => (
        <circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r={index % 2 === 0 ? 1.7 : 2.3}
          fill="#f3ead8"
          opacity={0.55}
          className="palace-dust"
          style={{ animationDelay: `${index * 0.85}s` }}
        />
      ))}
    </g>
  )
}

function Arch({
  x,
  y,
  w,
  h,
  vitality,
  shutter = false,
}: {
  x: number
  y: number
  w: number
  h: number
  vitality: number
  shutter?: boolean
}) {
  const radius = w / 2
  const glow = 0.3 + 0.7 * vitality
  const leaf = shutter ? (1 - vitality) * (w * 0.42) : 0
  return (
    <g opacity={0.42 + 0.58 * vitality} style={{ filter: `saturate(${0.2 + 0.8 * vitality})` }}>
      <path
        d={`M ${x} ${y + h} V ${y + radius} A ${radius} ${radius} 0 0 1 ${x + w} ${y + radius} V ${y + h} Z`}
        fill="#140f0c"
      />
      <path
        d={`M ${x + 2.2} ${y + h - 1} V ${y + radius} A ${radius - 2.2} ${radius - 2.2} 0 0 1 ${x + w - 2.2} ${y + radius} V ${y + h - 1} Z`}
        fill="#ffe6b0"
        opacity={glow}
        className="palace-lamp"
      />
      {leaf > 2 ? (
        <>
          <path
            d={`M ${x} ${y + h} V ${y + radius} A ${radius} ${radius} 0 0 1 ${x + leaf} ${y + radius + 1} V ${y + h} Z`}
            fill="#2c261f"
            opacity="0.92"
          />
          <path
            d={`M ${x + w - leaf} ${y + h} V ${y + radius + 1} A ${radius} ${radius} 0 0 0 ${x + w} ${y + radius} V ${y + h} Z`}
            fill="#2c261f"
            opacity="0.92"
          />
        </>
      ) : null}
    </g>
  )
}

function Tree({
  x,
  y,
  vitality,
  stage,
}: {
  x: number
  y: number
  vitality: number
  stage: number
}) {
  if (stage < 1) return null
  return (
    <g opacity={0.35 + 0.65 * vitality} style={{ filter: `saturate(${0.15 + 0.85 * vitality})` }}>
      <rect x={x - 4} y={y} width="8" height="34" rx="2" fill="#5c4030" />
      {stage >= 2 ? (
        <>
          <circle cx={x} cy={y - 6} r="22" fill="#3d6b50" />
          <circle cx={x - 14} cy={y + 2} r="14" fill="#2d5640" />
          <circle cx={x + 15} cy={y} r="15" fill="#4d7c5c" />
        </>
      ) : null}
      {stage >= 3 ? (
        <>
          <circle cx={x + 10} cy={y + 8} r="2.2" fill="#e7b3a4" />
          <circle cx={x - 8} cy={y + 6} r="1.8" fill="#f0d2c4" />
        </>
      ) : null}
    </g>
  )
}

export function PalaceScene({ model }: { model: PalaceModel }) {
  const focus = model.wings.focus
  const decisions = model.wings.decisions
  const boundaries = model.wings.boundaries
  const strategy = roomOf(focus, "strategy")
  const deep = roomOf(focus, "deep")
  const priorities = roomOf(focus, "priorities")
  const journal = roomOf(focus, "journal")
  const sleep = roomOf(decisions, "sleep")
  const balance = roomOf(decisions, "balance")
  const budget = roomOf(decisions, "budget")
  const archive = roomOf(decisions, "archive")
  const shutdown = roomOf(boundaries, "shutdown")
  const windows = roomOf(boundaries, "windows")
  const recovery = roomOf(boundaries, "recovery")
  const decline = roomOf(boundaries, "decline")

  const towerTop = [470, 392, 318, 236, 156][boundaries.stage] ?? 392
  const towerHeight = 548 - towerTop

  return (
    <svg viewBox="0 0 1200 700" className="h-auto w-full" aria-hidden="true">
      <defs>
        <linearGradient id="palace-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10211c" />
          <stop offset="46%" stopColor="#1d3a33" />
          <stop offset="78%" stopColor="#6e5b45" />
          <stop offset="100%" stopColor="#e4d2b4" />
        </linearGradient>
        <linearGradient id="palace-lawn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#234237" />
          <stop offset="100%" stopColor="#142820" />
        </linearGradient>
        <filter id="palace-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="palace-moon" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff8ea" />
          <stop offset="70%" stopColor="#f0e2c4" />
          <stop offset="100%" stopColor="#f0e2c4" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="1200" height="700" fill="url(#palace-sky)" />
      <circle cx="1010" cy="92" r="78" fill="url(#palace-moon)" opacity="0.9" />
      <circle cx="1010" cy="92" r="28" fill="#f7f1e4" />
      {[
        [140, 70],
        [220, 120],
        [310, 54],
        [690, 80],
        [760, 46],
        [860, 128],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="#f6f1e6" opacity="0.75" />
      ))}

      <path d="M0 430 C 180 360 320 390 520 360 C 760 322 900 390 1200 340 V 700 H 0 Z" fill="#1a332c" opacity="0.55" />
      <path d="M0 500 C 240 460 480 520 760 490 C 960 470 1080 510 1200 490 V 700 H 0 Z" fill="url(#palace-lawn)" />
      <path d="M430 700 C 470 620 520 600 610 592 C 700 600 760 640 820 700 Z" fill="#cbbfa8" opacity="0.28" />

      <g opacity={focus.stage === 0 ? 0.55 : focus.vitality}>
        <rect x="78" y="548" width="286" height="18" rx="3" fill="#d9c7aa" />
        {focus.stage >= 1 ? (
          <>
            <polygon points="318,330 362,308 362,530 318,552" fill="#14382f" />
            <rect x="78" y="330" width="240" height="220" fill="#1f6f5b" />
            <rect x="78" y="330" width="16" height="220" fill="#174e42" />
          </>
        ) : (
          <rect x="78" y="520" width="240" height="28" fill="#1f6f5b" opacity="0.45" />
        )}
        {focus.stage >= 3 ? (
          <>
            <polygon points="300,188 344,166 344,330 300,330" fill="#12352d" />
            <rect x="96" y="188" width="204" height="142" fill="#257863" />
          </>
        ) : null}
        {focus.stage >= 2 ? (
          <polygon
            points={focus.stage >= 3 ? "78,196 198,112 336,196" : "60,338 198,214 352,338"}
            fill="#102e28"
          />
        ) : null}
        {focus.stage >= 4 ? (
          <>
            <rect x="176" y="96" width="44" height="28" fill="#174e42" />
            <path d="M170 96 Q 198 62 226 96 Z" fill="#d7efe6" opacity="0.9" />
            <rect x="194" y="78" width="8" height="18" fill="#ffe6b0" className="palace-lamp" />
          </>
        ) : null}
      </g>

      {focus.stage >= 1
        ? [0, 1, 2].map((index) => (
            <Arch key={`focus-low-${index}`} x={108 + index * 68} y={390} w={36} h={78} vitality={strategy.vitality} />
          ))
        : null}
      {focus.stage >= 3
        ? [0, 1].map((index) => (
            <Arch key={`focus-high-${index}`} x={132 + index * 78} y={214} w={34} h={64} vitality={deep.vitality} />
          ))
        : null}
      {journal.stage >= 1 && focus.stage >= 1 ? (
        <g opacity={0.35 + 0.65 * journal.vitality} transform="translate(214 468)">
          <rect x="0" y="0" width="28" height="18" rx="1" fill="#f4efe4" />
          <path d="M14 0 V18" stroke="#8c6232" strokeWidth="1.4" />
        </g>
      ) : null}
      {priorities.stage >= 1 && focus.stage >= 2 ? (
        <g opacity={0.4 + 0.6 * priorities.vitality}>
          <line x1="250" y1={focus.stage >= 3 ? 150 : 250} x2="250" y2={focus.stage >= 3 ? 112 : 214} stroke="#f4efe4" strokeWidth="2" />
          <path d={`M250 ${focus.stage >= 3 ? 114 : 216} l 28 8 l -28 8 Z`} fill="#e7b3a4" />
        </g>
      ) : null}
      <Dust room={strategy} points={[[120, 470], [168, 500], [250, 486]]} />

      <g>
        <ellipse cx="430" cy="575" rx="54" ry="16" fill="#1a2420" />
        <ellipse cx="430" cy="568" rx="46" ry="12" fill="#31584c" />
        <ellipse cx="430" cy="566" rx="28" ry="7" fill="#8ec8b8" className="palace-water" opacity="0.85" />
        <path d="M430 548 C 434 534 426 528 430 514" fill="none" stroke="#d7efe6" strokeWidth="2" strokeLinecap="round" className="palace-water" />
      </g>

      <g opacity={decisions.stage === 0 ? 0.55 : decisions.vitality}>
        <polygon points="500,700 560,612 760,612 820,700" fill="#b7a48a" />
        {decisions.stage >= 1 ? (
          <>
            <polygon points="760,300 812,276 812,548 760,572" fill="#7a5a32" />
            <rect x="500" y="300" width="260" height="272" fill="#c4a36a" />
            <rect x="500" y="300" width="14" height="272" fill="#a68455" />
          </>
        ) : (
          <rect x="500" y="548" width="260" height="24" fill="#c4a36a" opacity="0.4" />
        )}
        {decisions.stage >= 2 ? <polygon points="480,308 630,196 780,308" fill="#5c4124" /> : null}
        {decisions.stage >= 4 ? <rect x="612" y="168" width="36" height="36" fill="#8d6a3d" /> : null}
      </g>
      {decisions.stage >= 3
        ? [0, 1, 2, 3].map((index) => (
            <rect key={`col-${index}`} x={528 + index * 58} y={360} width="16" height="150" fill="#f3e6d0" opacity="0.9" />
          ))
        : null}
      {balance.stage >= 1 && decisions.stage >= 2 ? (
        <g opacity={0.35 + 0.65 * balance.vitality} style={{ filter: `saturate(${0.2 + 0.8 * balance.vitality})` }}>
          <circle cx="630" cy="360" r="26" fill="#5c4124" />
          <circle cx="630" cy="360" r="16" fill="#ffe6b0" className="palace-lamp" />
          <path d="M630 332 v-16 M614 320 h32 M606 320 l-14 16 h20 z M654 320 l-14 16 h20 z" fill="none" stroke="#f6efe2" strokeWidth="2" strokeLinejoin="round" />
        </g>
      ) : null}
      {decisions.stage >= 2 ? (
        <>
          <rect x="602" y="470" width="56" height="102" fill="#4e341c" />
          <g opacity={0.35 + 0.65 * sleep.vitality} filter="url(#palace-glow)">
            <circle cx="630" cy="452" r="8" fill="#ffe6b0" className="palace-lamp" />
          </g>
        </>
      ) : null}
      {budget.stage >= 1 ? (
        <g opacity={0.45 + 0.55 * budget.vitality} style={{ filter: `saturate(${0.25 + 0.75 * budget.vitality})` }}>
          <path d="M478 600 V 528 Q 560 488 642 528 V 600" fill="none" stroke="#efe2cc" strokeWidth="6" strokeLinecap="round" />
        </g>
      ) : null}
      {archive.stage >= 1 ? (
        <g opacity={0.34 + 0.66 * archive.vitality} style={{ filter: `saturate(${0.2 + 0.8 * archive.vitality})` }}>
          <rect x="782" y="430" width="78" height="130" fill="#8d6a3d" />
          <polygon points="774,430 821,392 868,430" fill="#5c4124" />
          <Arch x={804} y={462} w={28} h={58} vitality={archive.vitality} />
        </g>
      ) : null}
      <Dust room={archive} points={[[800, 500], [830, 540], [860, 490]]} />
      <Dust room={sleep} points={[[600, 450], [660, 470]]} />

      <g opacity={boundaries.stage === 0 ? 0.55 : boundaries.vitality}>
        <rect x="860" y="500" width="300" height="78" rx="6" fill="#314056" />
        <rect x="860" y="500" width="300" height="10" fill="#243244" />
        {boundaries.stage >= 1 ? (
          <>
            <polygon points="1048,318 1104,292 1104,548 1048,548" fill="#1b2433" />
            <rect x="900" y="318" width="210" height="230" fill="#2c3b52" />
          </>
        ) : null}
        {boundaries.stage >= 1 ? (
          <>
            <polygon points={`${1112},${towerTop + 28} ${1168},${towerTop} ${1168},548 ${1112},548`} fill="#1a2333" />
            <rect x="1048" y={towerTop} width="110" height={towerHeight} fill="#243044" />
            <polygon points={`1036,${towerTop + 8} 1103,${towerTop - 48} 1170,${towerTop + 8}`} fill="#151c28" />
          </>
        ) : null}
        {boundaries.stage >= 4 ? <rect x="1094" y={towerTop - 70} width="8" height="28" fill="#e7d7c8" /> : null}
      </g>

      {boundaries.stage >= 1
        ? [0, 1, 2].map((index) => (
            <Arch key={`mail-${index}`} x={928 + index * 58} y={360} w={34} h={86} vitality={windows.vitality} shutter />
          ))
        : null}

      {boundaries.stage >= 1 ? (
        <g opacity={0.35 + 0.65 * shutdown.vitality} style={{ filter: `saturate(${0.12 + 0.88 * shutdown.vitality})` }}>
          <rect x="978" y="452" width="48" height="96" fill="#1a140f" />
          <path d="M978 452 h48 v8 h-48 z" fill="#c4785a" />
          <circle cx="1002" cy="430" r={6 + shutdown.vitality * 3} fill="#ffe6b0" className="palace-lamp" filter="url(#palace-glow)" />
          <line x1="1002" y1="404" x2="1002" y2="430" stroke="#e7d7c8" strokeWidth="2" />
        </g>
      ) : null}

      {decline.stage >= 1 ? (
        <g opacity={0.3 + 0.7 * decline.vitality} style={{ filter: `saturate(${0.2 + 0.8 * decline.vitality})` }} transform={`translate(1096 ${towerTop + 36})`}>
          <line x1="8" y1="-18" x2="8" y2="0" stroke="#f0e2c8" strokeWidth="2" />
          <path d="M0 2 Q 8 -16 16 2 L 18 12 H -2 Z" fill="#c4785a" />
          <circle cx="8" cy="16" r="2.4" fill="#f6efe4" />
        </g>
      ) : null}

      <Tree x={890} y={492} vitality={recovery.vitality} stage={recovery.stage} />
      {recovery.stage >= 4 ? <Tree x={1135} y={500} vitality={recovery.vitality} stage={recovery.stage} /> : null}
      {recovery.stage >= 3 ? (
        <g opacity={0.35 + 0.65 * recovery.vitality}>
          <rect x="940" y="548" width="36" height="6" rx="2" fill="#6b4a34" />
          <rect x="946" y="554" width="4" height="12" fill="#6b4a34" />
          <rect x="966" y="554" width="4" height="12" fill="#6b4a34" />
        </g>
      ) : null}

      {shutdown.dust ? <ellipse cx="1002" cy="490" rx="36" ry="48" fill="#efe6d6" opacity="0.16" /> : null}
      {recovery.dust ? <ellipse cx="980" cy="520" rx="120" ry="36" fill="#efe6d6" opacity="0.2" /> : null}
      <Dust room={shutdown} points={[[960, 470], [1020, 500], [990, 530]]} />
      <Dust room={recovery} points={[[870, 470], [910, 520], [1148, 490]]} />
      <Dust room={windows} points={[[940, 390], [1024, 400]]} />
    </svg>
  )
}
