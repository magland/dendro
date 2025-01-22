import os


# read the version from thisdir/version.txt
thisdir = os.path.dirname(os.path.realpath(__file__))
with open(os.path.join(thisdir, 'version.txt')) as f:
    __version__ = f.read().strip()
