/**
 * Exchange EWS API client wrapper
 */

import {
  ExchangeService,
  Uri,
  ExchangeVersion,
  WebCredentials,
  CalendarFolder,
  CalendarView,
  WellKnownFolderName,
  ItemId,
  Appointment,
  SendInvitationsMode,
  ConflictResolutionMode,
  SendInvitationsOrCancellationsMode,
  SendCancellationsMode,
  DeleteMode,
  MessageBody,
  BodyType,
  LegacyFreeBusyStatus,
  Sensitivity,
  DateTime as EwsDateTime,
  FolderView,
  PropertySet,
  BasePropertySet,
} from 'ews-javascript-api';
import type { ExchangeAuthManager } from './auth.js';
import { CalendarMCPError, ErrorCodes } from '../../utils/error.js';
import { XhrApi } from '@ewsjs/xhr';

/**
 * Exchange EWS client wrapper for calendar operations
 */
export class ExchangeEwsClient {
  private service: ExchangeService;

  constructor(private authManager: ExchangeAuthManager) {
    this.service = new ExchangeService(ExchangeVersion.Exchange2016);
    this.service.Url = new Uri(authManager.getEwsUrl());
    this.setupCredentials();
  }

  private setupCredentials(): void {
    const authMethod = this.authManager.getAuthMethod();
    const creds = this.authManager.getCredentials();

    if (authMethod === 'ntlm') {
      // Use @ewsjs/xhr with NTLM authentication
      const username = creds.domain
        ? `${creds.domain}\\${creds.username}`
        : creds.username;
      const xhr = new XhrApi()
        .useNtlmAuthentication(username, creds.password);
      this.service.XHRApi = xhr;
      // Also set credentials for library's internal checks
      this.service.Credentials = new WebCredentials(username, creds.password);
    } else if (authMethod === 'basic') {
      const username = creds.domain
        ? `${creds.domain}\\${creds.username}`
        : creds.username;
      this.service.Credentials = new WebCredentials(username, creds.password);
    }
    // OAuth would require custom implementation
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Calendar Operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * List calendar folders
   */
  async listCalendarFolders(): Promise<Array<{ id: string; name: string }>> {
    try {
      const folderView = new FolderView(100);
      const rootFolder = await CalendarFolder.Bind(
        this.service,
        WellKnownFolderName.Calendar
      );

      // For simplicity, return just the main calendar
      // A full implementation would search for all calendar folders
      return [{
        id: rootFolder.Id.UniqueId,
        name: 'Calendar',
      }];
    } catch (error) {
      throw this.handleApiError(error, 'listCalendarFolders');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Event Operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * List calendar events in a date range
   */
  async listEvents(params: {
    folderId?: string;
    startDate: Date;
    endDate: Date;
    maxResults?: number;
  }): Promise<Appointment[]> {
    try {
      const calendarView = new CalendarView(
        EwsDateTime.Parse(params.startDate.toISOString()),
        EwsDateTime.Parse(params.endDate.toISOString())
      );
      calendarView.MaxItemsReturned = params.maxResults ?? 100;

      const folder = await CalendarFolder.Bind(this.service, WellKnownFolderName.Calendar);

      const results = await folder.FindAppointments(calendarView);
      return results.Items as Appointment[];
    } catch (error) {
      throw this.handleApiError(error, 'listEvents');
    }
  }

  /**
   * Get a single appointment
   */
  async getAppointment(itemId: string): Promise<Appointment> {
    try {
      const id = new ItemId(itemId);
      const appointment = await Appointment.Bind(
        this.service,
        id,
        new PropertySet(BasePropertySet.FirstClassProperties)
      );
      return appointment;
    } catch (error) {
      throw this.handleApiError(error, 'getAppointment', itemId);
    }
  }

  /**
   * Create a new appointment
   */
  async createAppointment(params: {
    subject: string;
    body?: string;
    bodyType?: 'text' | 'html';
    start: Date;
    end: Date;
    location?: string;
    isAllDay?: boolean;
    requiredAttendees?: string[];
    optionalAttendees?: string[];
    showAs?: 'free' | 'busy' | 'tentative' | 'oof';
    sensitivity?: 'normal' | 'personal' | 'private' | 'confidential';
    sendInvites?: boolean;
  }): Promise<Appointment> {
    try {
      const appointment = new Appointment(this.service);

      appointment.Subject = params.subject;
      appointment.Start = EwsDateTime.Parse(params.start.toISOString());
      appointment.End = EwsDateTime.Parse(params.end.toISOString());

      if (params.body) {
        appointment.Body = new MessageBody(
          params.bodyType === 'html' ? BodyType.HTML : BodyType.Text,
          params.body
        );
      }

      if (params.location) {
        appointment.Location = params.location;
      }

      if (params.isAllDay) {
        appointment.IsAllDayEvent = true;
      }

      if (params.requiredAttendees) {
        for (const email of params.requiredAttendees) {
          appointment.RequiredAttendees.Add(email);
        }
      }

      if (params.optionalAttendees) {
        for (const email of params.optionalAttendees) {
          appointment.OptionalAttendees.Add(email);
        }
      }

      if (params.showAs) {
        const statusMap: Record<string, LegacyFreeBusyStatus> = {
          'free': LegacyFreeBusyStatus.Free,
          'busy': LegacyFreeBusyStatus.Busy,
          'tentative': LegacyFreeBusyStatus.Tentative,
          'oof': LegacyFreeBusyStatus.OOF,
        };
        appointment.LegacyFreeBusyStatus = statusMap[params.showAs] ?? LegacyFreeBusyStatus.Busy;
      }

      if (params.sensitivity) {
        const sensitivityMap: Record<string, Sensitivity> = {
          'normal': Sensitivity.Normal,
          'personal': Sensitivity.Personal,
          'private': Sensitivity.Private,
          'confidential': Sensitivity.Confidential,
        };
        appointment.Sensitivity = sensitivityMap[params.sensitivity] ?? Sensitivity.Normal;
      }

      const sendMode = params.sendInvites !== false &&
        (params.requiredAttendees?.length || params.optionalAttendees?.length)
        ? SendInvitationsMode.SendToAllAndSaveCopy
        : SendInvitationsMode.SendToNone;

      await appointment.Save(sendMode);

      return appointment;
    } catch (error) {
      throw this.handleApiError(error, 'createAppointment');
    }
  }

  /**
   * Update an appointment
   */
  async updateAppointment(
    itemId: string,
    updates: {
      subject?: string;
      body?: string;
      bodyType?: 'text' | 'html';
      start?: Date;
      end?: Date;
      location?: string;
      showAs?: 'free' | 'busy' | 'tentative' | 'oof';
      sensitivity?: 'normal' | 'personal' | 'private' | 'confidential';
      sendUpdates?: boolean;
    }
  ): Promise<Appointment> {
    try {
      const id = new ItemId(itemId);
      const appointment = await Appointment.Bind(
        this.service,
        id
      );

      if (updates.subject !== undefined) {
        appointment.Subject = updates.subject;
      }

      if (updates.body !== undefined) {
        appointment.Body = new MessageBody(
          updates.bodyType === 'html' ? BodyType.HTML : BodyType.Text,
          updates.body
        );
      }

      if (updates.start !== undefined) {
        appointment.Start = EwsDateTime.Parse(updates.start.toISOString());
      }

      if (updates.end !== undefined) {
        appointment.End = EwsDateTime.Parse(updates.end.toISOString());
      }

      if (updates.location !== undefined) {
        appointment.Location = updates.location;
      }

      if (updates.showAs !== undefined) {
        const statusMap: Record<string, LegacyFreeBusyStatus> = {
          'free': LegacyFreeBusyStatus.Free,
          'busy': LegacyFreeBusyStatus.Busy,
          'tentative': LegacyFreeBusyStatus.Tentative,
          'oof': LegacyFreeBusyStatus.OOF,
        };
        appointment.LegacyFreeBusyStatus = statusMap[updates.showAs] ?? LegacyFreeBusyStatus.Busy;
      }

      if (updates.sensitivity !== undefined) {
        const sensitivityMap: Record<string, Sensitivity> = {
          'normal': Sensitivity.Normal,
          'personal': Sensitivity.Personal,
          'private': Sensitivity.Private,
          'confidential': Sensitivity.Confidential,
        };
        appointment.Sensitivity = sensitivityMap[updates.sensitivity] ?? Sensitivity.Normal;
      }

      const sendMode = updates.sendUpdates !== false
        ? SendInvitationsOrCancellationsMode.SendToAllAndSaveCopy
        : SendInvitationsOrCancellationsMode.SendToNone;

      await appointment.Update(ConflictResolutionMode.AlwaysOverwrite, sendMode);

      return appointment;
    } catch (error) {
      throw this.handleApiError(error, 'updateAppointment', itemId);
    }
  }

  /**
   * Delete an appointment
   */
  async deleteAppointment(
    itemId: string,
    sendCancellation?: boolean
  ): Promise<void> {
    try {
      const id = new ItemId(itemId);
      const appointment = await Appointment.Bind(
        this.service,
        id
      );

      const deleteMode = sendCancellation !== false
        ? DeleteMode.MoveToDeletedItems
        : DeleteMode.HardDelete;

      const sendMode = sendCancellation !== false
        ? SendCancellationsMode.SendToAllAndSaveCopy
        : SendCancellationsMode.SendToNone;

      await appointment.Delete(deleteMode, sendMode);
    } catch (error) {
      throw this.handleApiError(error, 'deleteAppointment', itemId);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Event Response Operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Respond to a meeting invitation
   */
  async respondToMeeting(
    itemId: string,
    response: 'accept' | 'decline' | 'tentative',
    message?: string
  ): Promise<void> {
    try {
      const id = new ItemId(itemId);
      const appointment = await Appointment.Bind(
        this.service,
        id
      );

      switch (response) {
        case 'accept':
          await appointment.Accept(true); // true = send response
          break;
        case 'decline':
          await appointment.Decline(true);
          break;
        case 'tentative':
          await appointment.AcceptTentatively(true);
          break;
      }
    } catch (error) {
      throw this.handleApiError(error, 'respondToMeeting', itemId);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Free/Busy Operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get free/busy information
   * Note: EWS has GetUserAvailability but ews-javascript-api support may be limited
   */
  async getFreeBusy(params: {
    startTime: Date;
    endTime: Date;
  }): Promise<Array<{ start: string; end: string; status: string }>> {
    try {
      // For simplicity, we query appointments and derive busy times
      const appointments = await this.listEvents({
        startDate: params.startTime,
        endDate: params.endTime,
        maxResults: 500,
      });

      return appointments
        .filter(apt => apt.LegacyFreeBusyStatus !== LegacyFreeBusyStatus.Free)
        .map(apt => ({
          start: apt.Start.ToISOString(),
          end: apt.End.ToISOString(),
          status: apt.LegacyFreeBusyStatus?.toString() ?? 'busy',
        }));
    } catch (error) {
      throw this.handleApiError(error, 'getFreeBusy');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Error Handling
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Convert EWS errors to our error format
   */
  private handleApiError(error: unknown, operation: string, resourceId?: string): never {
    const ewsError = error as {
      ErrorCode?: number | string;
      message?: string;
    };

    const errorCode = ewsError.ErrorCode;
    const message = ewsError.message ?? 'Unknown error';

    // Map common EWS error codes
    if (typeof errorCode === 'string') {
      if (errorCode.includes('ErrorAccessDenied')) {
        throw new CalendarMCPError(
          `Access denied: ${message}`,
          ErrorCodes.PERMISSION_DENIED,
          { provider: 'exchange' }
        );
      }
      if (errorCode.includes('ErrorItemNotFound')) {
        throw new CalendarMCPError(
          resourceId ? `Item not found: ${resourceId}` : 'Item not found',
          ErrorCodes.EVENT_NOT_FOUND,
          { provider: 'exchange', details: { resourceId } }
        );
      }
      if (errorCode.includes('ErrorInvalidCredentials') || errorCode.includes('401')) {
        throw new CalendarMCPError(
          `Authentication failed: ${message}`,
          ErrorCodes.AUTH_FAILED,
          { provider: 'exchange' }
        );
      }
    }

    throw new CalendarMCPError(
      `${operation} failed: ${message}`,
      ErrorCodes.PROVIDER_UNAVAILABLE,
      {
        provider: 'exchange',
        retryable: true,
        details: { errorCode },
      }
    );
  }
}
