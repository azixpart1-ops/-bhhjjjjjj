var SMI_Countdown = (function () {
    'use strict';
    class SMI_Countdown {
        sectionEl = null;
        sectionId = null;
        x = null;
        constructor(_sectionID) {
            this._smiCountdown(_sectionID)
        }

        _smiCountdown(idSec) {
            let interval_countdown = localStorage.getItem(`interval_countdown_${idSec.substring((idSec.length - 5), idSec.length)}`)
            if (interval_countdown != "" && interval_countdown != null && interval_countdown != undefined) {
                clearInterval(interval_countdown)
            }

            const currentEl = document.getElementById('#SECTION_ID#');
            if (document.getElementById(`count_down_date_${idSec}`)) {
                let endtime = document.getElementById(`count_down_date_${idSec}`).value
                let hide_when_expire = document.getElementById(`hide_when_expire_${idSec}`).value
                let datecount = endtime.split(" ")
                let daycount = datecount[0]
                let timecount = []
                let date_detail_count = ""
                let truedate = true
                let dateformat = true
                let days_detail_count = daycount.replaceAll("-", " ").replaceAll("/", " ").split(" ")
                let days_filter = ""
                let times_filter = ""

                if (days_detail_count.length == 3) {
                    let year = days_detail_count[0]
                    if (year == undefined) {
                        dateformat = false
                    } else {
                        if (year.length < 4 || parseInt(year) > 2050) {
                            truedate = false
                        }
                    }

                    let month = days_detail_count[1]
                    if (month == "0") {
                        truedate = false
                    } else if (month == undefined) {
                        dateformat = false
                    } else if (parseInt(month) > 12) {
                        dateformat = false
                    } else {
                        if (month.length < 2) {
                            month = `0${month}`
                        }
                    }
                    let days = days_detail_count[2]
                    if (days == "0") {
                        truedate = false

                    } else if (days == undefined) {
                        dateformat = false

                    } else if (
                        (parseInt(month) == 2 && parseInt(days) > 28) ||
                        ((parseInt(month) == 4 || parseInt(month) == 6 || parseInt(month) == 9 || parseInt(month) == 11) && parseInt(days) > 30) ||
                        ((parseInt(month) == 1 || parseInt(month) == 3 || parseInt(month) == 5 || (parseInt(month) == 7 || parseInt(month) == 8 || parseInt(month) == 10 || parseInt(month) == 12)) && parseInt(days) > 31)) {
                        dateformat = false
                    } else {
                        if (days.length < 2) {
                            days = `0${days}`
                        }

                    }
                    if (isNaN(year) || isNaN(month) || isNaN(days)) truedate = false
                    days_filter = `${year}-${month}-${days}`

                } else {
                    truedate = false
                    dateformat = false
                }
                if (datecount.length > 1) {
                    timecount = datecount[1]
                    let time_detail_count = timecount.split(":")
                    let hour_count = time_detail_count[0]
                    let second_count = ""
                    if (time_detail_count.length < 2) {
                        dateformat = false
                    }

                    if (hour_count.length < 2) {
                        hour_count = `0${hour_count}`
                    } else if (parseInt(hour_count) > 24) {
                        truedate = false
                    }

                    if (time_detail_count.length > 1) {
                        second_count = time_detail_count[1]

                        if (second_count.length < 2) {
                            second_count = `0${second_count}`
                        } else if (parseInt(second_count) > 60) {
                            truedate = false
                        }
                    } else {
                        truedate = false
                    }
                    if (isNaN(second_count) || isNaN(hour_count)) truedate = false
                    times_filter = `${hour_count}:${second_count}`
                }
                let time_ready_for_count = `${days_filter} ${times_filter}`

                // let style_countdown = document.getElementById(`style_countdown_${idSec}`).value
                // let size_countdown = document.getElementById(`size_countdown_${idSec}`).value

                if (endtime == "" || endtime == undefined || endtime == null) {
                    document.getElementById(`1_day_unit_${idSec}`).innerHTML = "D"
                    document.getElementById(`2_day_unit_${idSec}`).innerHTML = "D"
                    document.getElementById(`1_hour_unit_${idSec}`).innerHTML = "H"
                    document.getElementById(`2_hour_unit_${idSec}`).innerHTML = "H"
                    document.getElementById(`1_minute_unit_${idSec}`).innerHTML = "M"
                    document.getElementById(`2_minute_unit_${idSec}`).innerHTML = "M"
                    document.getElementById(`1_second_unit_${idSec}`).innerHTML = "S"
                    document.getElementById(`2_second_unit_${idSec}`).innerHTML = "S"
                } else {
                    if (truedate == true && dateformat == true) {
                        if (time_ready_for_count.length > 0) {
                            time_ready_for_count = time_ready_for_count.replaceAll("-", "/")
                            var countDownDate = new Date(time_ready_for_count).getTime();

                            this.x = setInterval(function () {
                                var now = new Date().getTime();
                                if (dateformat == true) {
                                    if (countDownDate < now) {
                                        //console.log("cleared interval");
                                        clearInterval(this.x)

                                        if (hide_when_expire == "true" || hide_when_expire == true) {

                                            document.getElementById(`count_dount_timer_container_${idSec}`).innerHTML = ""
                                            if (document.querySelector(`.smi-block-type-countdown_timer-${idSec}`)) document.querySelector(`.smi-block-type-countdown_timer-${idSec}`).style.marginBottom = "0px"
                                            document.getElementById(`count_dount_timer_container_${idSec}`).classList.remove('smi-mb-lg')
                                            if (document.querySelector(`.smi-block-countdown_timer-${idSec}`)) document.querySelector(`.smi-block-countdown_timer-${idSec}`).classList.remove('smi-mb-lg')
                                            document.getElementById(`count_dount_timer_container_${idSec}`).style.marginBottom = "0px";

                                        } else {
                                            document.getElementById(`1_day_unit_${idSec}`).innerHTML = "0"
                                            document.getElementById(`2_day_unit_${idSec}`).innerHTML = "0"
                                            document.getElementById(`1_hour_unit_${idSec}`).innerHTML = "0"
                                            document.getElementById(`2_hour_unit_${idSec}`).innerHTML = "0"
                                            document.getElementById(`1_minute_unit_${idSec}`).innerHTML = "0"
                                            document.getElementById(`2_minute_unit_${idSec}`).innerHTML = "0"
                                            document.getElementById(`1_second_unit_${idSec}`).innerHTML = "0"
                                            document.getElementById(`2_second_unit_${idSec}`).innerHTML = "0"
                                        }

                                    } else {
                                        // Find the distance between now an the count down date
                                        var distance = countDownDate - now;
                                        // Time calculations for days, hours, minutes and seconds
                                        var days = Math.floor(distance / (1000 * 60 * 60 * 24));
                                        if (days < 10) {
                                            var days = '0' + days;
                                        } else {
                                            days = days;
                                        }
                                        var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                        if (hours < 10) {
                                            var hours = '0' + hours;
                                        } else {
                                            hours = hours;
                                        }
                                        var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                                        if (minutes < 10) {
                                            var minutes = '0' + minutes;
                                        } else {
                                            minutes = minutes;
                                        }
                                        var seconds = Math.floor((distance % (1000 * 60)) / 1000);

                                        let days_style = ""
                                        let days_count_text = ""

                                        if (days.toString().length < 2) {
                                            days_count_text = `0${days.toString()}`
                                        } else {
                                            days_count_text = days.toString()
                                        }
                                        for (let i = 0; i < days_count_text.length; i++) {
                                            if (i == 2 || i == 3) {
                                                document.getElementById(`${i + 1}_day_unit_${idSec}`).classList.remove('hide-days')
                                            }
                                            if (document.getElementById(`${i + 1}_day_unit_${idSec}`)) document.getElementById(`${i + 1}_day_unit_${idSec}`).innerText = days_count_text[i]
                                        }
                                        let hours_style = ""
                                        let hours_count_text = ""
                                        if (hours.toString().length < 2) {
                                            hours_count_text = `0${hours.toString()}`
                                        } else {
                                            hours_count_text = hours.toString()
                                        }
                                        for (let i = 0; i < hours_count_text.length; i++) {
                                            if (document.getElementById(`${i + 1}_hour_unit_${idSec}`)) document.getElementById(`${i + 1}_hour_unit_${idSec}`).innerText = hours_count_text[i]
                                            // hours_style += `<h3 class="${style_countdown} ${size_countdown}">${hours_count_text[i]}</h3>`
                                        }
                                        let minutes_style = ""
                                        let minutes_count_text = ""
                                        if (minutes.toString().length < 2) {
                                            minutes_count_text = `0${minutes.toString()}`
                                        } else {
                                            minutes_count_text = minutes.toString()
                                        }
                                        for (let i = 0; i < minutes_count_text.length; i++) {
                                            if (document.getElementById(`${i + 1}_minute_unit_${idSec}`)) document.getElementById(`${i + 1}_minute_unit_${idSec}`).innerText = minutes_count_text[i]
                                            // minutes_style += `<h3 class="${style_countdown} ${size_countdown}">${minutes_count_text[i]}</h3>`
                                        }
                                        let seconds_style = ""
                                        let secont_count_text = ""
                                        if (seconds.toString().length < 2) {
                                            secont_count_text = `0${seconds.toString()}`
                                        } else {
                                            secont_count_text = seconds.toString()
                                        }
                                        for (let i = 0; i < secont_count_text.length; i++) {
                                            if (document.getElementById(`${i + 1}_second_unit_${idSec}`)) document.getElementById(`${i + 1}_second_unit_${idSec}`).innerText = secont_count_text[i]
                                            // seconds_style += `<h3 class="${style_countdown} ${size_countdown}">${secont_count_text[i]}</h3>`
                                        }

                                        if (distance < 0) {
                                            clearInterval(this.x);
                                        }
                                    }
                                } else {
                                    clearInterval(this.x)
                                }
                            }, 1000)
                            localStorage.setItem(`interval_countdown_${idSec.substring((idSec.length - 5), idSec.length)}`, this.x);
                            var hours = 24; // to clear the localStorage after 1 hour
                            // (if someone want to clear after 8hrs simply change hours=8)
                            var now = new Date().getTime();
                            var setupTime = localStorage.getItem(`setupTime${idSec}`);
                            if (setupTime == null) {
                                localStorage.setItem(`setupTime${idSec}`, now)
                            } else {
                                if (now - setupTime > hours * 60 * 60 * 1000) {
                                    localStorage.removeItem(`interval_countdown_${idSec.substring((idSec.length - 5), idSec.length)}`);
                                    localStorage.setItem(`setupTime${idSec}`, now);
                                }
                            }
                            // intervals.push(x)
                        }
                    } else {
                        if (dateformat == false) {
                            document.getElementById(`count_dount_timer_container_${idSec}`).innerHTML = "<h4 class='smi-h4' style='opacity: 0.75; font-weight: 500;'>End date format is not available</h4>"
                        } else {
                            document.getElementById(`count_dount_timer_container_${idSec}`).innerHTML = "<h4 class='smi-h4' style='opacity: 0.75; font-weight: 500;'>End date is not available</h4>"
                        }
                    }
                }
            }
        }

        changeTimezone(date) {
            if (typeof date === 'string') {
                return new Date(
                    new Date(date).toLocaleString('en-US', {
                        timeZone: window.smiObject.timezone,
                    }),
                );
            }

            return new Date(
                date.toLocaleString('en-US', {
                    timeZone: window.smiObject.timezone,
                }),
            );
        }
    }
    return SMI_Countdown
})();

