type ExternalDestination = {
  availability: "coming-soon" | "live";
  label: string;
  url: string;
};

export const COMMUNITY_PROFILE: ExternalDestination = {
  availability: "coming-soon",
  label: "Dynatrace Community",
  url: "https://community.dynatrace.com/t5/user/viewprofilepage/user-id/45621",
};

export const isCommunityLive = () => COMMUNITY_PROFILE.availability === "live";
