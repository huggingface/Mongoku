import { Injectable } from '@angular/core';
import { Subject }    from 'rxjs';

interface Notification {
  type:    "error";
  message: string;
}

@Injectable()
export class NotificationsService {
  private notificationsSource = new Subject<Notification>();

  notifications = this.notificationsSource.asObservable();

  constructor() { }

  notifyError(message: string) {
    const notif: Notification = {
      type:    "error",
      message: message
    };

    this.notificationsSource.next(notif);
  }
}
