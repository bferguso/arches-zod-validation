import re
from django_hosts import patterns, host

host_patterns = patterns(
    "",
    host(
        re.sub(r"_", r"-", r"arches_zod_validation"),
        "arches_zod_validation.urls",
        name="arches_zod_validation",
    ),
)
