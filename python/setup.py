from setuptools import setup, find_packages

# read version from dendro/version.txt
with open('pairio/version.txt') as f:
    __version__ = f.read().strip()

setup(
    name='pairio',
    version=__version__,
    author="Jeremy Magland, Luiz Tauffer",
    author_email="jmagland@flatironinstitute.org",
    url="https://github.com/magland/pairio",
    description="",
    packages=find_packages(),
    include_package_data=True,
    package_data={'pairio': ['version.txt']},
    install_requires=[
        'click',
        'simplejson',
        'numpy',
        'PyYAML',
        'pydantic', # intentionally do not specify version 1 or 2 since we support both
        'psutil',
        'requests'
    ],
    extras_require={
        'compute_client': [
            'pubnub>=7.2.0'
        ]
    },
    entry_points={
        "console_scripts": [
            "pairio=pairio.cli:main",
        ],
    }
)
