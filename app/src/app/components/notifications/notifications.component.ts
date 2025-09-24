import { Component, OnInit } from "@angular/core";
import { NotificationsService } from "../../services/notifications.service";

@Component({
  selector:    "notifications",
  templateUrl: "./notifications.component.html",
  styleUrls:   ["./notifications.component.scss"],
})
export class NotificationsComponent implements OnInit {
  private _notifications = [];

  get notifications() {
    return Object.values(this._notifications);
  }

  constructor(private notifService: NotificationsService) {}

  ngOnInit() {
    this.notifService.notifications.subscribe((notif) => {
      this._notifications[notif.message] = notif;
      setTimeout(() => {
        this._notifications[notif.message].show = true;
      }, 10);
    });
  }

  dismiss(notif) {
    this._notifications[notif.message].show = false;
    setTimeout(() => {
      delete this._notifications[notif.message];
    }, 200);
  }
}
