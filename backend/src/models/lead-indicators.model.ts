export interface TotalLeadsIndicator {
  totalLeads: number;
}

export interface NewLeadsIndicator {
  newLeadsInLastSevenDays: number;
}

export interface UnassignedLeadsIndicator {
  unassignedLeads: number;
  shareOfBase: number;
}

export interface InvalidOrRejectedContactsIndicator {
  invalidOrRejectedContacts: number;
  shareOfBase: number;
}

export interface CompleteProfilesIndicator {
  completeProfiles: number;
  shareOfBase: number;
}
