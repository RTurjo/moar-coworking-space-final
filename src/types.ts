export type Role = 'admin' | 'host' | 'member';
export type MemberStatus = 'Active' | 'Renewal Due' | 'Expired';
export type DeskStatus = 'Available' | 'Occupied' | 'Reserved' | 'Inactive';
export type BillStatus = 'Paid' | 'Unpaid';
export type BookingStatus = 'Confirmed' | 'Pending' | 'Cancelled';
export type ContentType = 'notice' | 'event' | 'news';

export interface Profile {
  uid: string;
  email: string;
  displayName?: string;
  role: Role;
  memberId?: string;
  createdAt?: string;
}

export interface Branch {
  id: string;
  name: string;
  address?: string;
}

export interface Member {
  id: string;
  memberCode: string;
  fullName: string;
  phone: string;
  email: string;
  nid: string;
  company: string;
  branchId: string;
  deskId?: string;
  membershipType: string;
  status: MemberStatus;
  renewalDate: string;
  memberSince: string;
  dob?: string;
  contractUrl?: string;
  profilePhotoUrl?: string;
  usageLimitDays: number;
  usageLimitHours: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Desk {
  id: string;
  code: string;
  floor: string;
  branchId: string;
  status: DeskStatus;
  memberId?: string;
  renewalDate?: string;
  usagePercent?: number;
}

export interface Bill {
  id: string;
  billCode: string;
  memberId: string;
  type: string;
  amount: number;
  date: string;
  status: BillStatus;
  createdAt?: string;
}

export interface Booking {
  id: string;
  bookingCode: string;
  memberId: string;
  roomName: string;
  date: string;
  startTime: string;
  durationHours: number;
  price: number;
  status: BookingStatus;
  createdAt?: string;
}

export interface ContentItem {
  id: string;
  type: ContentType;
  title: string;
  description: string;
  date: string;
  status: 'Published' | 'Draft';
  tag?: string;
  author?: string;
  createdAt?: string;
}

export interface AttendanceLog {
  id: string;
  memberId: string;
  dateKey: string;
  monthKey: string;
  checkInAt: string;
  checkOutAt?: string;
  durationHours?: number;
  createdAt?: string;
}

export interface AppData {
  branches: Branch[];
  members: Member[];
  desks: Desk[];
  bills: Bill[];
  bookings: Booking[];
  content: ContentItem[];
  attendanceLogs: AttendanceLog[];
}

export interface UsageStats {
  monthKey: string;
  daysUsed: number;
  totalHours: number;
  avgHours: number;
  weekDaysUsed: number;
  remainingHours: number;
  remainingDays: number;
  activeLog?: AttendanceLog;
}
