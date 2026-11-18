export interface StoryReturn {
  path: string;
  surface: "stories-row" | "stories-feed" | "profile";
  groupUserId: string;
  storyId: string;
  comments: boolean;
}

const KEY = "nagrek-story-return";

export function rememberStory(value: StoryReturn) {
  sessionStorage.setItem(KEY, JSON.stringify(value));
}

export function peekStoryReturn(path: string, surface: StoryReturn["surface"]): StoryReturn | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as StoryReturn;
    if (saved.path !== path || saved.surface !== surface || !saved.groupUserId || !saved.storyId) return null;
    return saved;
  } catch {
    return null;
  }
}

export function clearStoryReturn() {
  sessionStorage.removeItem(KEY);
}
