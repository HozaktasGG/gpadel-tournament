export type QuizOption = {
  id: string
  label: string
  score: number
}

export type QuizQuestion = {
  id: string
  section: string
  title: string
  options: QuizOption[]
}

export const QUIZ_SECTIONS = [
  { id: 'experience', title: 'Experience', max: 200 },
  { id: 'technical', title: 'Technical Skills', max: 300 },
  { id: 'tactical', title: 'Tactical Knowledge', max: 300 },
  { id: 'style', title: 'Playing Style', max: 200 },
] as const

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    section: 'experience',
    title: 'How long have you been playing padel?',
    options: [
      { id: 'a', label: 'First time', score: 20 },
      { id: 'b', label: 'Less than 6 months', score: 40 },
      { id: 'c', label: '6 months - 1 year', score: 80 },
      { id: 'd', label: '1-2 years', score: 120 },
      { id: 'e', label: '2-4 years', score: 160 },
      { id: 'f', label: '4+ years', score: 200 },
    ],
  },
  {
    id: 'q2',
    section: 'experience',
    title: 'How often do you play?',
    options: [
      { id: 'a', label: '1-2 times per month', score: 20 },
      { id: 'b', label: 'Once a week', score: 50 },
      { id: 'c', label: '2-3 times per week', score: 100 },
      { id: 'd', label: '4+ times per week', score: 150 },
    ],
  },
  {
    id: 'q3',
    section: 'experience',
    title: 'Experience with other racket sports? (tennis, squash, badminton)',
    options: [
      { id: 'a', label: 'None', score: 0 },
      { id: 'b', label: 'Amateur', score: 30 },
      { id: 'c', label: 'Regular', score: 60 },
      { id: 'd', label: 'Professional', score: 100 },
    ],
  },
  {
    id: 'q4',
    section: 'technical',
    title: 'Bandeja (controlled mid-power shot from net)',
    options: [
      { id: 'a', label: "Don't know it", score: 0 },
      { id: 'b', label: "Know it but can't do it", score: 20 },
      { id: 'c', label: 'Sometimes', score: 50 },
      { id: 'd', label: 'Use it regularly', score: 80 },
    ],
  },
  {
    id: 'q5',
    section: 'technical',
    title: 'Vibora (attacking shot)',
    options: [
      { id: 'a', label: "Don't know it", score: 0 },
      { id: 'b', label: 'Rarely', score: 20 },
      { id: 'c', label: 'Solid', score: 50 },
      { id: 'd', label: 'Tactical use', score: 80 },
    ],
  },
  {
    id: 'q6',
    section: 'technical',
    title: 'Smash (por tres / por cuatro)',
    options: [
      { id: 'a', label: 'Only on easy balls', score: 20 },
      { id: 'b', label: 'Generally successful', score: 50 },
      { id: 'c', label: 'Powerful and placed', score: 80 },
    ],
  },
  {
    id: 'q7',
    section: 'technical',
    title: 'Wall usage (back + side)',
    options: [
      { id: 'a', label: 'Struggle with walls', score: 10 },
      { id: 'b', label: 'Can use back wall', score: 30 },
      { id: 'c', label: 'Use both walls tactically', score: 60 },
    ],
  },
  {
    id: 'q8',
    section: 'tactical',
    title: 'Where is the most advantageous position to win a point?',
    options: [
      { id: 'a', label: 'Baseline', score: 0 },
      { id: 'b', label: 'At the net (volley position)', score: 50 },
      { id: 'c', label: 'Mid-court', score: 20 },
      { id: 'd', label: "Doesn't matter", score: 0 },
    ],
  },
  {
    id: 'q9',
    section: 'tactical',
    title: 'When do you use a lob?',
    options: [
      { id: 'a', label: 'Only when losing', score: 0 },
      { id: 'b', label: 'To push opponents back from the net', score: 50 },
      { id: 'c', label: "When we can't reach the ball", score: 20 },
      { id: 'd', label: 'Always too risky', score: 0 },
    ],
  },
  {
    id: 'q10',
    section: 'tactical',
    title: "Opponents are at the net, you're at the baseline. Smartest move?",
    options: [
      { id: 'a', label: 'Hit hard at their feet', score: 20 },
      { id: 'b', label: 'Lob to push them back', score: 50 },
      { id: 'c', label: 'Slow slice', score: 30 },
      { id: 'd', label: 'Direct smash attempt', score: 0 },
    ],
  },
  {
    id: 'q11',
    section: 'tactical',
    title: 'What does "double fault" mean in padel?',
    options: [
      { id: 'a', label: 'Two net touches', score: 0 },
      { id: 'b', label: 'Serve missed twice', score: 50 },
      { id: 'c', label: '4 players miss the ball', score: 0 },
      { id: 'd', label: 'Not sure', score: 0 },
    ],
  },
  {
    id: 'q12',
    section: 'tactical',
    title: 'Where should the serve land?',
    options: [
      { id: 'a', label: "Anywhere in opponent's box", score: 10 },
      { id: 'b', label: "In opponent's service box, bouncing once", score: 50 },
      { id: 'c', label: 'Directly into the box', score: 20 },
      { id: 'd', label: 'Not sure', score: 0 },
    ],
  },
  {
    id: 'q13',
    section: 'tactical',
    title: 'What does "por 3" mean?',
    options: [
      { id: 'a', label: 'Calling a 3rd player', score: 0 },
      { id: 'b', label: 'Ball going over the fence after smash', score: 50 },
      { id: 'c', label: 'Start of 3rd set', score: 0 },
      { id: 'd', label: "Referee's point", score: 0 },
    ],
  },
  {
    id: 'q14',
    section: 'style',
    title: 'Tournament experience?',
    options: [
      { id: 'a', label: 'None', score: 0 },
      { id: 'b', label: '1-3 tournaments', score: 40 },
      { id: 'c', label: '4-10 tournaments', score: 80 },
      { id: 'd', label: '10+ tournaments', score: 120 },
    ],
  },
  {
    id: 'q15',
    section: 'style',
    title: 'Communication with your partner?',
    options: [
      { id: 'a', label: "We don't talk", score: 0 },
      { id: 'b', label: 'Basic (mine, yours)', score: 20 },
      { id: 'c', label: 'Constant', score: 40 },
      { id: 'd', label: 'We plan tactics', score: 60 },
    ],
  },
  {
    id: 'q16',
    section: 'style',
    title: 'Preferred position?',
    options: [
      { id: 'a', label: 'Right (drive)', score: 10 },
      { id: 'b', label: 'Left (backhand)', score: 10 },
      { id: 'c', label: 'Both sides', score: 20 },
    ],
  },
]

export function getLevel(score: number): string {
  if (score >= 1001) return 'Advanced'
  if (score >= 501) return 'Intermediate'
  if (score > 0) return 'Beginner'
  return 'Unranked'
}

export type LevelStyle = {
  bg: string
  text: string
  icon?: string
}

export function getLevelColor(level: string): LevelStyle {
  switch (level) {
    case 'Advanced':
      return { bg: '#f97316', text: '#ffffff' }
    case 'Intermediate':
      return { bg: '#22c55e', text: '#ffffff' }
    case 'Beginner':
      return { bg: '#3b82f6', text: '#ffffff' }
    case 'Unranked':
    default:
      return { bg: '#6b7280', text: '#ffffff' }
  }
}
