// Copyright (C) 2015 GRNET S.A.

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

function go_to_restore_single(name) {
    g_res_directory = RESTORE_DEFAULT_DIR;
    var time_path = $("#time-path").val();
    if(time_path != "/") time_path += "/";
    if(time_path.startsWith("/")) time_path = time_path.replace("/", "");

    g_res_file = time_path + name;
    g_timestamp = selected_date;

    $("#restore-tab-link").trigger("click");
}

function escape_illegal_chars(s) {
    if(!s) return "";
    return s.replace(/("|'|;|{|}|\\|\.|:|\[|\]|,)/g, "\\$1");
}

function show_contents_by_date(error, stdout, stderr) {
    toggle_error(error, stderr);
    $("#time-contents").empty();

    var ul = $("<ul></ul>")
        .attr("class", "no-bullet")
        .attr("id", "timeview-contents-list");
    var contents = JSON.parse(stdout);
    $.each(contents, function(i, el) {
        var f = "open_folder('" + escape_illegal_chars(el.name) + "')";
        var restore_f = "show_rest_icon('" + i + "')";
        var title = (el.name.length > 30) ? el.name : "";
        var el_link = $("<a></a>")
            .attr("href", "#")
            .attr("title", title)
            .attr("onclick", restore_f);
        if(el.type == 'dir') {
            el_link.attr("ondblclick", f);
        }
        var locale_date = new Date(el.timestamp).toLocaleString();
        var filename = (el.name.length > 30) ?
            el.name.substring(0,7) + "..." + el.name.substring(el.name.length-7, el.name.length):
                el.name;
        var li = $("<li>&nbsp;<span>" + filename + "&nbsp;</span><span class='right'>"
            + locale_date + "</span></li>")
            .attr("id", el.name);
        var icon_class = (el.type == 'dir')
            ? "fa fa-folder yellow-folder left" :
            "fa fa-file-text-o green-file left";
        var icon = $("<i></i>")
            .attr("class", icon_class);
        var rest_icon = $("<i></i>")
            .attr("id", "rest_icon_" + i)
            .attr("title", "Restore")
            .attr("class", "hide")
            .attr("onclick", "go_to_restore_single('" + escape_illegal_chars(el.name) + "')");

        li.append(icon);
        li.append(rest_icon);
        el_link.append(li);
        ul.append(el_link);
    });

    $("#time-contents").append(ul);
    $("#loader").hide();
}

function show_rest_icon(name) {
    $("#rest_icon_" + name).removeClass("hide");
    $("#rest_icon_" + name).addClass("fa fa-download");
}

var init_path = "";
function open_folder(name) {
    $("#time-path").val(init_path + name);
    get_contents_by_date(selected_date);
}

function go_to_path(cur_path) {
    if( cur_path != "/") {
        cur_path = cur_path.slice(0,-1);
    }
    $("#time-path").val(cur_path);
    get_contents_by_date(selected_date);
}

function fill_breadcrumbs(path) {
    $(".breadcrumbs").empty();
    var path_parts = [];
    if(path != "/") {
        path_parts = path.split("/");
    } else {
        path_parts = [path];
    }
    var len = path_parts.length;
    var cur_path = "";
    $.each(path_parts, function(i, value) {
        if(value == "/" || !value) {
            value = "ROOT";
            cur_path = "/";
        } else {
            cur_path += value + "/";
        }
        var li_crumb = $("<li></li>");
        if(i == len-1) {
            li_crumb.addClass("current");
        }
        var a_crumb = $("<a>" + value + "</a>")
            .attr("href", "#")
            .attr("onclick", "go_to_path('" + escape_illegal_chars(cur_path) + "')");
        li_crumb.append(a_crumb);
        $(".breadcrumbs").append(li_crumb);
    });
}

var selected_date = "";
function get_contents_by_date(value) {
    $("#loader").show();
    if(selected_date) {
        $("#" + escape_illegal_chars(selected_date)).
            removeClass("active-li");
    }
    $("#" + escape_illegal_chars(value)).
        addClass("active-li");
    var time_path = $("#time-path").val();
    if(!time_path) {
        $("#time-head-error small").text(errors.path_empty);
        $("#time-head-error small").show();
        return;
    } else {
        $("#time-head-error small").text('');
        $("#time-head-error small").hide();
    }
    selected_date = value;
    fill_breadcrumbs(time_path);
    if(time_path != "/") {
        init_path = time_path + "/";
    } else {
        init_path = time_path;
    }
    var datapath = path.join(BAAS_CACHE_DIR, 'timeviews');

    var time_cmd = "python " + TIMEVIEW_PATH + " " + datapath + " swift://" +
        container + " get " + value + " " + escape_quote_str(time_path);
    if(process.platform == 'win32') {
        var cmd = build_win_commands();
        var args = ["-c", cmd + time_cmd];
        execFile(CYGWIN_BASH, args, show_contents_by_date);
    } else {
        exec(time_cmd, show_contents_by_date);
    }
}

function load_timeview() {
    $("#backup_details").hide();
    $("#loader").show();

    function puts(error, stdout, stderr) {
        $("#loader").hide();
        toggle_error(error, stderr);
        if(!error) {
            var datetime_reg = /\d{4}-\d{2}-\d{2}.\d{2}:\d{2}:\d{2}\s+\d+/g;
            var dates = stdout.match(datetime_reg);
            var dates_list = "";
            if(dates) {
                dates = dates.sort();
                $.each(dates, function(i, value) {
                    value = value.substring(0, 19);
                    var iso_time = value.replace('.', 'T');
                    dates_list += "<a href='#' onclick='get_contents_by_date(\""
                        + iso_time + "\")' id='" + iso_time + "'>" + value.replace('.', ' ') + "</a><br>";
                });
            }
            $("#time-dates").html(dates_list);
        } else {
            parse_cloud_error(false, stderr, false);
        }
    }
    var dup_cmd = DUPLICITY_PATH + " collection-status swift://" + container;
    if(process.platform == 'win32') {
        var cmd = build_win_commands();
        var args = ["-c", cmd + dup_cmd];
        execFile(CYGWIN_BASH, args, puts);
    } else {
        set_envs();
        exec(dup_cmd, {maxBuffer: 1000*1024} , puts);
    }
}

