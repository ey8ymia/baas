# Copyright (C) 2015 GRNET S.A.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
#

import os
import sys
import shutil
import json


APP = 'baas'
DISTPATH = 'dist'

OS_OPTIONS = [
    "win64",
    "osx64",
    "linux64",
    "win32",
    "osx32",
    "linux32",
]


def get_version():
    pkg_file = os.path.join('baas', 'package.json')
    with open(pkg_file) as f:
        info = json.load(f)
        return info.get('version', '')

def copy_cacert():
    os.chdir(os.path.dirname(os.path.realpath(__file__)))
    os.system("pip install certifi")

    print "Copying certifi's cacert.pem"
    import certifi
    shutil.copy2(certifi.where(), 'baas/resources/cacert.pem')

def main():
    copy_cacert()
    os.chdir(os.path.dirname(os.path.realpath(__file__)))

    if len(sys.argv) < 2 or sys.argv[1] not in OS_OPTIONS:
        print "Select one of: %s" % " ".join(OS_OPTIONS)
        exit(1)

    osarg = sys.argv[1]
    descr = "-".join(sys.argv[1:])
    version = get_version()

    os.chdir(DISTPATH)
    filename = '%s-%s-%s' % (APP, version, descr)
    if osarg.startswith('osx'):
        base_dir = '%s.app' % APP
        arch_name = "%s.zip" % filename
        os.system("zip -ry %s %s" % (arch_name, base_dir))
    else:
        if osarg.startswith("linux"):
            arch_type = 'gztar'
            base_dir = APP
        elif osarg.startswith('win'):
            arch_type = 'zip'
            base_dir = APP

        arch_name = shutil.make_archive(
            filename, arch_type, root_dir='.', base_dir=base_dir)
    print "Wrote %s" % os.path.join(DISTPATH, arch_name)

if __name__ == "__main__":
    main()
