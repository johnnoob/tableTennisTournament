export interface Player {
  id: string;
  name: string;
  username: string;
  rank: number;
  rating: number;
  avatar: string;
  isVerified: boolean;
  department?: string;
  stats: {
    wins: number;
    losses: number;
    winRate: number;
    avgScore: number;
    seasonWinRate?: number;
    maxStreak?: number;
  };
  racketConfig?: {
    forehand: string;
    backhand: string;
  };
  nemesis?: RivalryItem[];
  prey?: RivalryItem[];
  title?: string;
}

export interface Match {
  id: string;
  opponent: Partial<Player>;
  player1: Partial<Player>; // Added for Arena View
  date: string;
  score: [number, number];
  result: 'win' | 'loss';
  status: 'completed' | 'pending' | 'disputed';
  mmrChange: [number, number]; // [P1_Change, P2_Change]
  tournament?: string;
}

export interface Prize {
  position: '01' | '02' | '03';
  label: string;
  item: string;
  description: string;
  image: string;
}

export interface Tournament {
  id: string;
  title: string;
  status: 'ongoing' | 'upcoming' | 'completed';
  startDate: string;
  endDate: string;
  location: string;
  rules: string;
  prizePool: string;
  participants: number;
  prizes: Prize[];
}

export const currentUser: Player = {
  id: 'current-user',
  name: '陳大文',
  username: 'Nova',
  rank: 12,
  rating: 2450,
  avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=400&h=400&fit=crop',
  isVerified: true,
  department: '資訊部 / 技術處',
  stats: {
    wins: 142,
    losses: 38,
    winRate: 78.9,
    avgScore: 24.5,
  }
};

export const players: Player[] = [
  {
    id: 'p1',
    name: '林怡君',
    username: 'Kevin',
    rank: 1,
    rating: 3125,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop',
    isVerified: true,
    department: '秘書處 / 第一組',
    title: 'CHAMPION STANDING',
    stats: { wins: 320, losses: 45, winRate: 94.2, avgScore: 28.2, seasonWinRate: 96.5, maxStreak: 24 },
    racketConfig: { forehand: '平面－澀性膠皮', backhand: '平面－黏性膠皮' },
    nemesis: [
      { id: 'n1', name: 'Sarah Tseng', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop', winRate: 35 },
      { id: 'n2', name: 'Alex Liu', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop', winRate: 41 }
    ],
    prey: [
      { id: 'm1', name: 'Jason Wang', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop', winRate: 90 },
      { id: 'm2', name: 'Linda Chen', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop', winRate: 88 }
    ]
  },
  {
    id: 'p2',
    name: '陳偉安',
    username: 'Sarah',
    rank: 2,
    rating: 2840,
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
    isVerified: true,
    department: '資訊部 / 技術處',
    title: 'ELITE',
    stats: { wins: 280, losses: 62, winRate: 79.8, avgScore: 26.5, seasonWinRate: 82.1, maxStreak: 15 },
    racketConfig: { forehand: '平面－黏性膠皮', backhand: '平面－澀性膠皮' },
    nemesis: [
      { id: 'n1', name: 'Kevin Lin', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop', winRate: 15 }
    ],
    prey: [
      { id: 'm1', name: 'Emily Wong', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop', winRate: 85 }
    ]
  },
  {
    id: 'p3',
    name: '黃柏翰',
    username: 'Jason',
    rank: 3,
    rating: 2610,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
    isVerified: false,
    department: '法務部 / 營運組',
    title: 'ELITE',
    stats: { wins: 210, losses: 88, winRate: 72.5, avgScore: 23.8 }
  },
  {
    id: 'p4',
    name: '王小明',
    username: 'Emily',
    rank: 4,
    rating: 2450,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
    isVerified: false,
    department: '研發中心 / 第二開發課',
    title: 'HISTORICAL PEAK',
    stats: { wins: 24, losses: 4, winRate: 85.7, avgScore: 21.0 }
  },
  {
    id: 'p5',
    name: '李國華',
    username: 'Mike',
    rank: 5,
    rating: 2320,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    isVerified: false,
    department: '總務處 / 資產管理',
    title: 'PERSISTENT GUARD',
    stats: { wins: 22, losses: 6, winRate: 78.5, avgScore: 20.5 }
  },
  {
    id: 'p6',
    name: '張雅婷',
    username: 'Tina',
    rank: 6,
    rating: 2280,
    avatar: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?w=400&h=400&fit=crop',
    isVerified: false,
    department: '人事室 / 培訓組',
    stats: { wins: 21, losses: 7, winRate: 75.0, avgScore: 19.5 }
  },
  {
    id: 'p7',
    name: '趙雲',
    username: 'Cloud',
    rank: 7,
    rating: 2115,
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop',
    isVerified: false,
    department: '戰略規劃部 / 前瞻組',
    stats: { wins: 19, losses: 9, winRate: 67.8, avgScore: 18.2 }
  }
];

export const matches: Match[] = [
  {
    id: 'm1',
    player1: { name: '陳大文', avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=400&h=400&fit=crop' },
    opponent: { name: '李小龍', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop' },
    date: '2 小時前',
    score: [3, 1],
    result: 'win',
    status: 'completed',
    mmrChange: [15, -12],
    tournament: 'Autumn Champion Cup'
  },
  {
    id: 'm2',
    player1: { name: '張學友', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop' },
    opponent: { name: '林家謙', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop' },
    date: '5 小時前',
    score: [3, 2],
    result: 'win',
    status: 'pending',
    mmrChange: [18, -14],
    tournament: 'Global Open Qualifiers'
  },
  {
    id: 'm3',
    player1: { name: '周杰倫', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop' },
    opponent: { name: '王菲', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop' },
    date: '昨天 21:30',
    score: [1, 3],
    result: 'loss',
    status: 'disputed',
    mmrChange: [-10, 16],
    tournament: 'Regional Finals'
  }
];

export const tournaments: Tournament[] = [
  {
    id: 't1',
    title: '2026 春季長官盃',
    status: 'ongoing',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    location: 'Main Sports Hall, Building B',
    rules: 'Standard ITTF rules. Best of 3 sets for qualifiers, Best of 5 for Finals. All participants must log matches within 24h.',
    prizePool: '$50,000',
    participants: 128,
    prizes: [
      {
        position: '01',
        label: 'CHAMPION',
        item: 'Carbon Fiber Paddle + Trophy',
        description: 'Pro-grade equipment for elites.',
        image: '/images/prizes/carbon_fiber_paddle_trophy_1774933886152.png'
      },
      {
        position: '02',
        label: 'RUNNER UP',
        item: 'Premium Paddle + Case',
        description: 'High-grip rubber with protective kit.',
        image: '/images/prizes/premium_paddle_case_1774933901049.png'
      },
      {
        position: '03',
        label: 'THIRD PLACE',
        item: '3-Star Competition Balls',
        description: 'Pack of 12 tournament-standard balls.',
        image: '/images/prizes/competition_balls_3star_1774933916332.png'
      }
    ]
  }
];

export interface RivalryItem {
  id: string;
  name: string;
  avatar: string;
  winRate: number;
}

export const nemesis: RivalryItem[] = [
  {
    id: 'n1',
    name: 'Sarah Jenkins',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
    winRate: 12
  },
  {
    id: 'n2',
    name: 'Jason Miller',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
    winRate: 24
  }
];

export const minions: RivalryItem[] = [
  {
    id: 'm1',
    name: 'Emily Wong',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
    winRate: 92
  },
  {
    id: 'm2',
    name: 'Mike Peterson',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    winRate: 88
  }
];

