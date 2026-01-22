
import { AppSettings, Scout, TrailLevel } from './types';

export const INITIAL_DATA = {
  version: "1.8.0",
  settings: {
    leaderSecret: "SKAUT-TAJEMSTVI-MODRY-SIP",
    mandatoryPoints: 1,
    optionalPoints: 1,
    scoring: {
      mandatoryTask: 10,
      optionalTask: 5,
      attendancePresent: 10,
      attendanceLate: 5,
      attendanceExcused: 2
    },
    pdfUrl: "",
    activeLevelId: "zeme",
    showTotalLeaderboard: false,
    adminProfile: {
      nickname: "Admin",
      avatar: "⚙️"
    },
    meetings: [
      {
        id: "m1",
        date: "2025-06-01T16:00",
        notes: "První schůzka v roce! Seznámení se stezkou.",
        attendance: {},
        photos: [],
        albumUrl: "https://photos.app.goo.gl/yoqtdFEe9Us46bB39",
        articles: []
      }
    ],
    bonuses: [],
    flappyScores: [],
    playTimes: []
  } as AppSettings,
  scouts: [
    {
      id: "1",
      name: "Jan Novák",
      nickname: "Kofola",
      avatar: "🦊",
      role: "user",
      pointsByLevel: { "zeme": 0, "voda": 0, "vzduch": 0, "ohen": 0 },
      activitiesProgress: {},
      activityCompletionDates: {},
      completedActivities: [],
      password: "1234",
      mustChangePassword: true,
      unlockedLevels: ["zeme"]
    },
    {
      id: "2",
      name: "Petr Svoboda",
      nickname: "Vlk",
      avatar: "🐺",
      role: "user",
      pointsByLevel: { "zeme": 0 },
      activitiesProgress: {},
      activityCompletionDates: {},
      completedActivities: [],
      password: "1234",
      mustChangePassword: true,
      unlockedLevels: ["zeme"]
    },
    {
      id: "3",
      name: "Anna Černá",
      nickname: "Sýkorka",
      avatar: "🐦",
      role: "user",
      pointsByLevel: { "zeme": 0 },
      activitiesProgress: {},
      activityCompletionDates: {},
      completedActivities: [],
      password: "1234",
      mustChangePassword: true,
      unlockedLevels: ["zeme"]
    }
  ] as Scout[],
  trailLevels: [
    {
      id: "zeme",
      name: "Cesta Země",
      color: "#3b5a3b",
      icon: "🌱",
      areas: [
        {
          id: "zeme_znam",
          title: "Co umím a znám",
          icon: "💡",
          subcategories: [
            {
              title: "1. Praktický život",
              requiredOptionalCount: 1,
              activities: [
                { id: "zeme_1_v1", title: "Pořádek ve stanu", description: "Po celou dobu tábora si budu udržovat pořádek a přehled ve svém stanu.", isMandatory: false, pointsValue: 10 },
                { id: "zeme_1_v2", title: "Údržba oblečení", description: "Budu si udržovat své oblečení a boty čisté a srovnané.", isMandatory: false, pointsValue: 10 },
                { id: "zeme_1_v3", title: "Úklid v pokoji", description: "Pravidelně si budu uklízet ve svém pokoji.", isMandatory: false, pointsValue: 10 },
                { id: "zeme_1_v4", title: "Hygienické návyky", description: "Dodržuji základní hygienické návyky.", isMandatory: false, pointsValue: 10 }
              ]
            }
          ]
        }
      ]
    }
  ] as TrailLevel[]
};
