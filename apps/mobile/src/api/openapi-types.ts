/**
 * Hand-authored OpenAPI `paths` types for the CBS REST API (Section 8).
 *
 * This is a LOCAL, deliberately-minimal subset shaped exactly the way
 * `openapi-fetch` expects (`paths[path][method].parameters / requestBody /
 * responses`). It exists so `apps/mobile` is self-contained and type-checks
 * without the generated client.
 *
 * TODO(packages): delete this file and import the generated `paths` type from
 * `@cbs/api-client` (produced by `openapi-typescript` from `/api/openapi.yaml`)
 * once the shared workspace package is wired up.
 */
import type {
  AvailabilityResult,
  BookingDetail,
  BookingStatus,
  BookingSummary,
  Building,
  CalendarBlock,
  Equipment,
  LoginResponse,
  Me,
  Notification,
  Room,
  RoomType,
} from '@/schemas';

interface Cursor<T> {
  data: T[];
  next_cursor: string | null;
}

type JsonContent<T> = { content: { 'application/json': T } };

export interface paths {
  '/auth/login': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            email: string;
            password: string;
            mfaCode?: string;
          };
        };
      };
      responses: {
        200: JsonContent<LoginResponse>;
      };
    };
  };
  '/auth/refresh': {
    post: {
      requestBody: {
        content: { 'application/json': { refreshToken: string } };
      };
      responses: {
        200: JsonContent<LoginResponse>;
      };
    };
  };
  '/auth/logout': {
    post: {
      requestBody: {
        content: { 'application/json': { refreshToken: string } };
      };
      responses: { 204: { content?: never } };
    };
  };
  '/auth/me': {
    get: {
      responses: { 200: JsonContent<Me> };
    };
  };
  '/buildings': {
    get: {
      responses: { 200: JsonContent<{ data: Building[] }> };
    };
  };
  '/equipment': {
    get: {
      responses: { 200: JsonContent<{ data: Equipment[] }> };
    };
  };
  '/rooms': {
    get: {
      parameters: {
        query?: {
          building_id?: string;
          min_capacity?: number;
          room_type?: RoomType;
          status?: string;
          limit?: number;
          cursor?: string;
        };
      };
      responses: { 200: JsonContent<Cursor<Room>> };
    };
  };
  '/availability/search': {
    get: {
      parameters: {
        query: {
          date: string;
          start: string;
          end: string;
          building_id?: string;
          min_capacity?: number;
          room_type?: RoomType;
          equipment?: string;
        };
      };
      responses: {
        200: JsonContent<{ data: AvailabilityResult[] }>;
      };
    };
  };
  '/bookings': {
    get: {
      parameters: {
        query?: {
          scope?: 'mine' | 'pending' | 'all';
          status?: BookingStatus;
          room_id?: string;
          date?: string;
          limit?: number;
          cursor?: string;
        };
      };
      responses: { 200: JsonContent<Cursor<BookingSummary>> };
    };
    post: {
      requestBody: {
        content: {
          'application/json': {
            roomId: string;
            startsAt: string;
            endsAt: string;
            purpose: string;
            attendeeCount: number;
          };
        };
      };
      responses: {
        201: JsonContent<BookingDetail>;
      };
    };
  };
  '/bookings/{id}': {
    get: {
      parameters: { path: { id: string } };
      responses: { 200: JsonContent<BookingDetail> };
    };
  };
  '/bookings/{id}/approve': {
    post: {
      parameters: { path: { id: string } };
      requestBody?: {
        content: { 'application/json': { note?: string } };
      };
      responses: { 200: JsonContent<BookingDetail> };
    };
  };
  '/bookings/{id}/reject': {
    post: {
      parameters: { path: { id: string } };
      requestBody: {
        content: { 'application/json': { note: string } };
      };
      responses: { 200: JsonContent<BookingDetail> };
    };
  };
  '/bookings/{id}/cancel': {
    post: {
      parameters: { path: { id: string } };
      requestBody?: {
        content: { 'application/json': { note?: string } };
      };
      responses: { 200: JsonContent<BookingDetail> };
    };
  };
  '/calendar': {
    get: {
      parameters: {
        query: {
          view: 'day' | 'week' | 'month';
          date: string;
          room_id?: string;
          building_id?: string;
        };
      };
      responses: { 200: JsonContent<{ data: CalendarBlock[] }> };
    };
  };
  '/notifications': {
    get: {
      parameters: {
        query?: { unread?: boolean; limit?: number; cursor?: string };
      };
      responses: { 200: JsonContent<Cursor<Notification>> };
    };
  };
  '/notifications/{id}/read': {
    post: {
      parameters: { path: { id: string } };
      responses: { 204: { content?: never } };
    };
  };
  '/notifications/read-all': {
    post: {
      responses: { 204: { content?: never } };
    };
  };
  '/devices': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            expoPushToken: string;
            platform: 'ios' | 'android';
            deviceName?: string;
          };
        };
      };
      responses: { 201: { content?: never } };
    };
  };
}
